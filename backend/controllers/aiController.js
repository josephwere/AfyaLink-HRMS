import Appointment from '../models/Appointment.js';
import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";
import User from "../models/User.js";
import { predictNextAvailableSlot, simpleRiskScore } from '../utils/aiUtils.js';
import { extractDocumentBase64, assistantChat } from "../services/aiAdapter.js";
import { logAudit } from "../services/auditService.js";
import { normalizeRole } from "../utils/normalizeRole.js";

export const suggestSlot = async (req, res, next) => {
  try {
    const { hospital, doctor, date } = req.query;
    const day = date ? new Date(date) : new Date();
    const appointments = await Appointment.find({ hospital, doctor, scheduledAt: { $gte: new Date(day.setHours(0,0,0,0)), $lt: new Date(new Date(day).setDate(day.getDate()+1)) } });
    const slot = predictNextAvailableSlot(appointments, date ? new Date(date) : new Date());
    res.json({ suggested: slot });
  } catch (err) { next(err); }
};

export const patientRisk = async (req, res, next) => {
  try {
    const patient = req.body;
    const score = simpleRiskScore(patient);
    res.json({ score });
  } catch (err) { next(err); }
};

export const extractDocument = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ message: "No uploaded file provided" });
    }

    const contentBase64 = file.buffer.toString("base64");
    const extraction = await extractDocumentBase64({
      contentBase64,
      mimeType: file.mimetype,
      filename: file.originalname,
    });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "AI_DOCUMENT_EXTRACTED",
      resource: "ai_document",
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        provider: extraction?.provider || "unknown",
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({
      ok: true,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extraction,
    });
  } catch (err) {
    next(err);
  }
};

async function resolvePatientIdsForUser(userId, hospitalId = null) {
  const user = await User.findById(userId).select("phone nationalIdNumber");
  if (!user) return [];
  const filters = [];
  if (user.nationalIdNumber) filters.push({ nationalId: user.nationalIdNumber });
  if (user.phone) filters.push({ contact: user.phone });
  filters.push({ "metadata.userId": userId });
  const where = { active: true, $or: filters };
  if (hospitalId) where.hospital = hospitalId;
  const rows = await Patient.find(where).select("_id");
  return rows.map((p) => String(p._id));
}

function buildAdvice({ role, symptoms = [], vitals = {}, assistantProfile = {}, nextAppointmentAt = null }) {
  const alerts = [];
  const recommendations = [];
  const normalizedSymptoms = symptoms.map((s) => String(s || "").toLowerCase());
  const temp = Number(vitals.temperatureC || 0);
  const spo2 = Number(vitals.spo2 || 0);

  if (spo2 > 0 && spo2 < 92) {
    alerts.push("Low oxygen level detected (SpO2 below 92%). Seek urgent medical care.");
  }
  if (temp >= 39) {
    alerts.push("High fever detected (>=39°C). Consult a doctor as soon as possible.");
  }
  if (normalizedSymptoms.some((s) => /chest pain|shortness of breath|faint/.test(s))) {
    alerts.push("Critical symptom detected. Visit emergency care immediately.");
  }

  if (nextAppointmentAt) {
    recommendations.push(`Upcoming appointment: ${new Date(nextAppointmentAt).toLocaleString()}. Keep this visit.`);
  } else if (role === "PATIENT") {
    recommendations.push("No upcoming appointment found. Book a check-up if symptoms persist.");
  }

  const meds = Array.isArray(assistantProfile?.medications) ? assistantProfile.medications : [];
  if (meds.length) {
    recommendations.push(
      `Dose reminder: ${meds
        .slice(0, 3)
        .map((m) => `${m.name || "Medication"} (${m.schedule || "as prescribed"})`)
        .join(", ")}.`
    );
  }

  const conditions = Array.isArray(assistantProfile?.conditions) ? assistantProfile.conditions : [];
  if (conditions.length) {
    recommendations.push(`Chronic care check: monitor ${conditions.slice(0, 3).join(", ")} regularly.`);
  }

  if (!alerts.length && !recommendations.length) {
    recommendations.push("Maintain hydration, rest, and monitor your symptoms. Seek care if symptoms worsen.");
  }

  return {
    alerts,
    recommendations,
    disclaimer:
      "AI guidance is supportive only and not a diagnosis. Follow clinician instructions and local emergency protocols.",
  };
}

export const getAssistantContext = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || "");
    const hospitalId = req.user?.hospitalId || req.user?.hospital || null;
    let nextAppointment = null;

    if (role === "PATIENT") {
      const patientIds = await resolvePatientIdsForUser(req.user.id, hospitalId || null);
      if (patientIds.length) {
        nextAppointment = await Appointment.findOne({
          patient: { $in: patientIds },
          scheduledAt: { $gte: new Date() },
          status: { $in: ["Scheduled", "CheckedIn", "InConsultation"] },
        })
          .sort({ scheduledAt: 1 })
          .select("scheduledAt reason status")
          .lean();
      }
    } else if (role === "DOCTOR") {
      nextAppointment = await Appointment.findOne({
        doctor: req.user.id,
        scheduledAt: { $gte: new Date() },
        status: { $in: ["Scheduled", "CheckedIn", "InConsultation"] },
      })
        .sort({ scheduledAt: 1 })
        .select("scheduledAt reason status")
        .lean();
    }

    const activePrescriptions = await Prescription.countDocuments({
      patient: req.user.id,
      status: { $in: ["Pending"] },
    });

    const profile = req.user?.metadata?.aiAssistant || {};
    return res.json({
      success: true,
      context: {
        role,
        nextAppointment,
        activePrescriptions,
        assistantProfile: profile,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const updateAssistantProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const current = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
    const incoming = req.body?.assistantProfile || {};
    user.metadata = {
      ...current,
      aiAssistant: {
        conditions: Array.isArray(incoming.conditions)
          ? incoming.conditions.map((x) => String(x).trim()).filter(Boolean)
          : [],
        medications: Array.isArray(incoming.medications)
          ? incoming.medications.map((m) => ({
              name: String(m?.name || "").trim(),
              dosage: String(m?.dosage || "").trim(),
              schedule: String(m?.schedule || "").trim(),
            }))
          : [],
        notes: String(incoming.notes || "").trim(),
        updatedAt: new Date().toISOString(),
      },
    };
    await user.save();
    return res.json({ success: true, assistantProfile: user.metadata.aiAssistant });
  } catch (err) {
    return next(err);
  }
};

export const getAssistantAdvice = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || "");
    const hospitalId = req.user?.hospitalId || req.user?.hospital || null;
    let nextAppointmentAt = null;
    if (role === "PATIENT") {
      const patientIds = await resolvePatientIdsForUser(req.user.id, hospitalId || null);
      if (patientIds.length) {
        const appt = await Appointment.findOne({
          patient: { $in: patientIds },
          scheduledAt: { $gte: new Date() },
          status: { $in: ["Scheduled", "CheckedIn", "InConsultation"] },
        })
          .sort({ scheduledAt: 1 })
          .select("scheduledAt")
          .lean();
        nextAppointmentAt = appt?.scheduledAt || null;
      }
    }

    const profile = req.user?.metadata?.aiAssistant || {};
    const advice = buildAdvice({
      role,
      symptoms: Array.isArray(req.body?.symptoms) ? req.body.symptoms : [],
      vitals: req.body?.vitals || {},
      assistantProfile: profile,
      nextAppointmentAt,
    });

    return res.json({
      success: true,
      advice,
    });
  } catch (err) {
    return next(err);
  }
};

export const getAssistantChat = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || "");
    const profile = req.user?.metadata?.aiAssistant || {};
    const message = String(req.body?.message || "").trim();
    const pageContext = String(req.body?.pageContext || "").trim();
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    const out = await assistantChat({
      message,
      role,
      pageContext,
      healthProfile: profile,
    });

    return res.json({
      success: true,
      answer: out?.text || out?.answer || "No response generated",
      provider: out?.provider || "unknown",
    });
  } catch (err) {
    return next(err);
  }
};

export const summarizeAssistantPage = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || "");
    const pageContext = String(req.body?.pageContext || "").trim();
    if (!pageContext) {
      return res.status(400).json({ message: "pageContext is required" });
    }

    const out = await assistantChat({
      message:
        "Summarize this page into: (1) key points, (2) urgent actions, (3) next best actions. Keep it short.",
      role,
      pageContext,
      healthProfile: req.user?.metadata?.aiAssistant || {},
    });

    return res.json({
      success: true,
      summary: out?.text || out?.answer || "No summary generated",
      provider: out?.provider || "unknown",
    });
  } catch (err) {
    return next(err);
  }
};
