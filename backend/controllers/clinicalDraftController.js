import ClinicalDraft from "../models/ClinicalDraft.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import workflowService from "../services/workflowService.js";
import { audit } from "../utils/audit.js";
import { WORKFLOW } from "../constants/workflowStates.js";

const DRAFT_TYPES = new Set(["OPD_CONSULTATION", "DOCTOR_NOTE"]);

function actorHospitalId(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

async function resolvePatient(req) {
  const hospitalId = actorHospitalId(req);
  const { patientId } = req.query;
  if (!patientId) return null;
  return Patient.findOne({ _id: patientId, hospital: hospitalId, active: true }).lean();
}

async function resolveAppointment(req, patient) {
  const hospitalId = actorHospitalId(req);
  const appointmentId = req.body?.appointmentId || req.query?.appointmentId || null;
  const baseWhere = {
    hospital: hospitalId,
    patient: patient._id,
    status: { $ne: "Cancelled" },
  };

  if (appointmentId) {
    return Appointment.findOne({
      ...baseWhere,
      _id: appointmentId,
    });
  }

  return Appointment.findOne({
    ...baseWhere,
    $or: [{ doctor: req.user._id }, { doctor: { $exists: false } }],
  }).sort({
    scheduledAt: -1,
    createdAt: -1,
  });
}

function mergeConsultationSummary(existing = {}, payload = {}) {
  const next = { ...(existing || {}) };
  if (payload.diagnosis) next.diagnosis = String(payload.diagnosis).trim();
  if (payload.treatmentPlan) next.carePlan = String(payload.treatmentPlan).trim();
  if (payload.followUp) next.followUpDate = String(payload.followUp).trim();
  if (payload.symptoms) next.symptoms = String(payload.symptoms).trim();
  if (payload.assessment) next.assessment = String(payload.assessment).trim();
  return next;
}

function buildPromotedUpdates(type, appointment, payload) {
  const metadata = { ...(appointment.metadata || {}) };
  if (type === "OPD_CONSULTATION") {
    metadata.consultationSummary = mergeConsultationSummary(
      metadata.consultationSummary,
      payload
    );
    metadata.followUpRequired = Boolean(payload.followUp);
    metadata.lastPromotedDraftType = type;
    metadata.lastPromotedDraftAt = new Date().toISOString();
    return {
      status:
        appointment.status === "Scheduled" || appointment.status === "CheckedIn"
          ? "InConsultation"
          : appointment.status,
      notes: String(payload.assessment || appointment.notes || "").trim(),
      metadata,
    };
  }

  metadata.doctorNote = {
    summary: String(payload.summary || "").trim(),
    note: String(payload.note || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  metadata.lastPromotedDraftType = type;
  metadata.lastPromotedDraftAt = new Date().toISOString();
  return {
    metadata,
  };
}

async function ensureEncounterForAppointment(req, appointment) {
  let encounter = await Encounter.findOne({
    appointment: appointment._id,
    hospital: appointment.hospital,
  });

  if (encounter) return encounter;

  encounter = new Encounter({
    patient: appointment.patient,
    doctor: appointment.doctor || req.user._id,
    hospital: appointment.hospital,
    appointment: appointment._id,
    state: WORKFLOW.CREATED,
  });
  encounter.$locals = { ...(encounter.$locals || {}), viaWorkflow: true };
  await encounter.save();
  return encounter;
}

async function applyDraftToEncounter(req, type, appointment, payload) {
  const encounter = await ensureEncounterForAppointment(req, appointment);
  const summaryBits = [];

  if (type === "OPD_CONSULTATION") {
    if (payload.symptoms) summaryBits.push(`Symptoms: ${String(payload.symptoms).trim()}`);
    if (payload.assessment) summaryBits.push(`Assessment: ${String(payload.assessment).trim()}`);
    if (payload.treatmentPlan) summaryBits.push(`Treatment: ${String(payload.treatmentPlan).trim()}`);
    if (payload.followUp) summaryBits.push(`Follow-up: ${String(payload.followUp).trim()}`);
    encounter.consultationNotes = summaryBits.join("\n") || encounter.consultationNotes || "";
    if (payload.diagnosis) {
      encounter.diagnosis = String(payload.diagnosis).trim();
    }
    if (encounter.state === WORKFLOW.CREATED) {
      encounter.state = WORKFLOW.CONSULTING;
    }
  } else {
    const noteParts = [String(payload.summary || "").trim(), String(payload.note || "").trim()].filter(Boolean);
    if (noteParts.length) {
      encounter.consultationNotes = noteParts.join("\n\n");
    }
    if (encounter.state === WORKFLOW.CREATED) {
      encounter.state = WORKFLOW.CONSULTING;
    }
  }

  encounter.$locals = { ...(encounter.$locals || {}), viaWorkflow: true };
  await encounter.save();
  return encounter;
}

export async function getClinicalDraft(req, res) {
  const { type } = req.params;
  if (!DRAFT_TYPES.has(type)) {
    return res.status(400).json({ message: "Invalid draft type" });
  }
  const patient = await resolvePatient(req);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const draft = await ClinicalDraft.findOne({
    hospital: actorHospitalId(req),
    patient: patient._id,
    author: req.user._id,
    draftType: type,
  }).lean();

  return res.json({
    item: draft || null,
  });
}

export async function saveClinicalDraft(req, res) {
  const { type } = req.params;
  if (!DRAFT_TYPES.has(type)) {
    return res.status(400).json({ message: "Invalid draft type" });
  }
  const patient = await resolvePatient(req);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};

  const draft = await ClinicalDraft.findOneAndUpdate(
    {
      hospital: actorHospitalId(req),
      patient: patient._id,
      author: req.user._id,
      draftType: type,
    },
    {
      $set: {
        payload,
        hospital: actorHospitalId(req),
        patient: patient._id,
        author: req.user._id,
        draftType: type,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await audit({
    req,
    action: "CLINICAL_DRAFT_SAVE",
    resource: "ClinicalDraft",
    resourceId: draft._id,
    after: draft.toObject(),
    metadata: {
      patientId: String(patient._id),
      draftType: type,
    },
  });

  return res.json({
    message: "Draft saved",
    item: draft,
  });
}

export async function promoteClinicalDraft(req, res) {
  const { type } = req.params;
  if (!DRAFT_TYPES.has(type)) {
    return res.status(400).json({ message: "Invalid draft type" });
  }
  const patient = await resolvePatient(req);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const draft = await ClinicalDraft.findOne({
    hospital: actorHospitalId(req),
    patient: patient._id,
    author: req.user._id,
    draftType: type,
  });

  if (!draft || !draft.payload || typeof draft.payload !== "object") {
    return res.status(404).json({ message: "Draft not found" });
  }

  const appointment = await resolveAppointment(req, patient);
  if (!appointment) {
    return res.status(404).json({ message: "No matching appointment found for this patient" });
  }

  const updates = buildPromotedUpdates(type, appointment, draft.payload || {});
  const wf = await workflowService.transition("CONSULTATION", appointment.workflowId, {
    updates,
    actor: req.user,
  });
  const encounter = await applyDraftToEncounter(req, type, wf.context.appointment, draft.payload || {});

  draft.payload = {
    ...(draft.payload || {}),
    _promotion: {
      promotedAt: new Date().toISOString(),
      appointmentId: String(appointment._id),
      encounterId: String(encounter._id),
      promotedBy: String(req.user._id),
    },
  };
  await draft.save();

  await audit({
    req,
    action: "CLINICAL_DRAFT_PROMOTE",
    resource: "ClinicalDraft",
    resourceId: draft._id,
    after: draft.toObject(),
    metadata: {
      patientId: String(patient._id),
      appointmentId: String(appointment._id),
      encounterId: String(encounter._id),
      draftType: type,
    },
  });

  return res.json({
    message: "Draft promoted to appointment",
    appointment: wf.context.appointment,
    encounter,
    draft,
  });
}
