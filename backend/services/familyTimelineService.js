import Appointment from "../models/Appointment.js";
import Claim from "../models/Claim.js";
import Encounter from "../models/Encounter.js";
import Invoice from "../models/Invoice.js";
import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";
import Report from "../models/Report.js";
import Transfer from "../models/Transfer.js";
import User from "../models/User.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { calculateAge, resolvePatientIdsForUser } from "./familyMonitoringService.js";
import { resolveMinorConsentPolicy } from "./minorConsentPolicyService.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

function fullName(row) {
  return [row?.firstName, row?.lastName].filter(Boolean).join(" ").trim() || "Family member";
}

function buildPath(type) {
  switch (type) {
    case "APPOINTMENT":
      return "/patient/appointments";
    case "ENCOUNTER":
    case "REPORT":
      return "/patient/medical-records";
    case "PRESCRIPTION":
      return "/patient/prescriptions";
    case "CLAIM":
    case "INVOICE":
      return "/patient/billing";
    case "TRANSFER":
      return "/patient/transfers";
    case "VACCINATION":
      return "/patient/family-records";
    default:
      return "/patient/family-timeline";
  }
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function patientVisibility(patient, user, settings) {
  const age = calculateAge(patient?.dob);
  const consentPolicy = resolveMinorConsentPolicy({
    age,
    countryCode:
      patient?.familyGroup?.parentNationalIdCountry ||
      patient?.countryId ||
      user?.nationalIdCountry ||
      "",
    settings,
  });

  return {
    age,
    consentPolicy,
    detailedClinicalNotes: consentPolicy?.permissions?.detailedClinicalNotes !== false,
    relationship:
      patient?.familyGroup?.relationship ||
      (String(patient?.metadata?.parentUserId || "") === String(user?._id || "") ? "PARENT" : "SELF"),
  };
}

function timelineItem({
  type,
  occurredAt,
  patient,
  patientView,
  title,
  detail,
  status = "",
  metadata = {},
}) {
  return {
    type,
    occurredAt,
    patientId: patient?._id || null,
    patientName: fullName(patient),
    hospitalId: patient?.hospital?._id || patient?.hospital || null,
    hospitalName: patient?.hospital?.name || "",
    relationship: patientView?.relationship || patient?.familyGroup?.relationship || "SELF",
    memberType: patient?.familyGroup?.memberType || "SELF",
    consentMode: patientView?.consentPolicy?.mode || "PARENT_PROXY",
    redacted: patientView?.detailedClinicalNotes === false,
    title,
    detail,
    status,
    path: buildPath(type),
    metadata,
  };
}

export async function buildFamilyTimelineForUser({ userId, limit = 120 }) {
  const [user, settings] = await Promise.all([
    User.findById(userId).select("name phone nationalIdCountry"),
    getSystemSettingsDoc({ lean: true }),
  ]);
  if (!user) {
    return { members: [], items: [] };
  }

  const patientIds = await resolvePatientIdsForUser(userId, null, { includeLinkedMinors: true });
  if (!patientIds.length) {
    return { members: [], items: [] };
  }

  const patients = await Patient.find({ _id: { $in: patientIds }, active: true })
    .populate("hospital", "name")
    .select("firstName lastName dob gender hospital familyGroup metadata updatedAt")
    .lean();

  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));
  const patientViews = new Map(
    patients.map((patient) => [String(patient._id), patientVisibility(patient, user, settings)])
  );

  const familyMembers = patients
    .map((patient) => {
      const view = patientViews.get(String(patient._id));
      return {
        patientId: patient._id,
        name: fullName(patient),
        age: view?.age ?? null,
        gender: patient.gender || "",
        relationship: view?.relationship || "SELF",
        memberType: patient.familyGroup?.memberType || "SELF",
        hospitalName: patient.hospital?.name || "",
        consentMode: view?.consentPolicy?.mode || "PARENT_PROXY",
        redacted: view?.detailedClinicalNotes === false,
        lastUpdatedAt: patient.updatedAt || null,
      };
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  const familyLimit = Math.max(20, Math.min(Number(limit || 120), 250));

  const [appointments, encounters, reports, prescriptions, claims, transfers] = await Promise.all([
    Appointment.find({ patient: { $in: patientIds } })
      .sort({ scheduledAt: -1, createdAt: -1 })
      .limit(familyLimit)
      .lean(),
    Encounter.find({ patient: { $in: patientIds } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(familyLimit)
      .lean(),
    Report.find({ patient: { $in: patientIds } })
      .sort({ createdAt: -1 })
      .limit(familyLimit)
      .lean(),
    Prescription.find({ patientRecord: { $in: patientIds }, status: { $ne: "CANCELLED" } })
      .sort({ dispensedAt: -1, createdAt: -1 })
      .limit(familyLimit)
      .lean(),
    Claim.find({ patient: { $in: patientIds } })
      .sort({ createdAt: -1 })
      .limit(familyLimit)
      .lean(),
    Transfer.find({ patient: { $in: patientIds } })
      .sort({ createdAt: -1 })
      .limit(familyLimit)
      .lean(),
  ]);

  const encounterIds = encounters.map((row) => row._id).filter(Boolean);
  const [invoices, vaccinationRecords] = await Promise.all([
    encounterIds.length
      ? Invoice.find({ encounter: { $in: encounterIds } })
          .sort({ createdAt: -1 })
          .limit(familyLimit)
          .lean()
      : [],
    (async () => {
      const familyNames = patients.map((patient) => fullName(patient)).filter(Boolean);
      const hospitalIds = Array.from(
        new Set(patients.map((patient) => String(patient.hospital?._id || patient.hospital || "")).filter(Boolean))
      );
      if (!familyNames.length || !hospitalIds.length) return [];
      return VaccinationRecord.find({
        hospital: { $in: hospitalIds },
        memberName: { $in: familyNames },
      })
        .sort({ administeredAt: -1, createdAt: -1 })
        .limit(familyLimit)
        .lean();
    })(),
  ]);

  const encounterPatientMap = new Map(encounters.map((encounter) => [String(encounter._id), String(encounter.patient)]));
  const patientNameKeyMap = new Map(
    patients.map((patient) => [
      `${String(patient.hospital?._id || patient.hospital || "")}::${fullName(patient).toLowerCase()}`,
      patient,
    ])
  );

  const items = [];

  appointments.forEach((row) => {
    const patient = patientMap.get(String(row.patient));
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    items.push(
      timelineItem({
        type: "APPOINTMENT",
        occurredAt: row.scheduledAt || row.createdAt,
        patient,
        patientView: view,
        title: `${row.serviceType || "Consultation"} appointment`,
        detail:
          row.reason ||
          row.notes ||
          `${row.consultationMode || "IN_PERSON"} • ${row.status || "Scheduled"}`,
        status: row.status || "",
        metadata: {
          appointmentId: row._id,
          consultationMode: row.consultationMode || "",
        },
      })
    );
  });

  encounters.forEach((row) => {
    const patient = patientMap.get(String(row.patient));
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    const redacted = view?.detailedClinicalNotes === false;
    items.push(
      timelineItem({
        type: "ENCOUNTER",
        occurredAt: row.closedAt || row.createdAt,
        patient,
        patientView: view,
        title: redacted ? "Clinical visit updated" : row.diagnosis || "Clinical visit updated",
        detail: redacted
          ? "Detailed teen clinical notes are hidden in shared-access mode."
          : row.consultationNotes || "Encounter summary recorded.",
        status: row.state || "",
        metadata: {
          encounterId: row._id,
        },
      })
    );
  });

  reports.forEach((row) => {
    const patient = patientMap.get(String(row.patient));
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    const redacted = view?.detailedClinicalNotes === false;
    items.push(
      timelineItem({
        type: "REPORT",
        occurredAt: row.createdAt,
        patient,
        patientView: view,
        title: redacted ? "Clinical report added" : row.title || "Clinical report added",
        detail: redacted
          ? "A new report exists for this teen family member."
          : String(row.content || "").slice(0, 220) || "Clinical report uploaded.",
        metadata: {
          reportId: row._id,
        },
      })
    );
  });

  prescriptions.forEach((row) => {
    const patient = patientMap.get(String(row.patientRecord));
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    const redacted = view?.detailedClinicalNotes === false;
    items.push(
      timelineItem({
        type: "PRESCRIPTION",
        occurredAt: row.dispensedAt || row.createdAt,
        patient,
        patientView: view,
        title: redacted ? "Prescription updated" : row.summary || "Prescription updated",
        detail: redacted
          ? `Prescription status: ${row.status || "CREATED"}`
          : row.advice || row.medications?.map((item) => item.name).filter(Boolean).join(", ") || "Medication issued.",
        status: row.status || "",
        metadata: {
          prescriptionId: row._id,
        },
      })
    );
  });

  claims.forEach((row) => {
    const patient = patientMap.get(String(row.patient));
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    items.push(
      timelineItem({
        type: "CLAIM",
        occurredAt: row.decision?.reviewedAt || row.createdAt,
        patient,
        patientView: view,
        title: `${row.provider?.name || row.provider?.code || "Insurance"} claim`,
        detail: `Amount ${Number(row.totalAmount || 0).toLocaleString()} ${row.currency || "KES"}`,
        status: row.status || "",
        metadata: {
          claimId: row._id,
          providerCode: row.provider?.code || "",
        },
      })
    );
  });

  invoices.forEach((row) => {
    const patientId = encounterPatientMap.get(String(row.encounter));
    const patient = patientId ? patientMap.get(String(patientId)) : null;
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    items.push(
      timelineItem({
        type: "INVOICE",
        occurredAt: row.paidAt || row.createdAt,
        patient,
        patientView: view,
        title: "Billing invoice updated",
        detail: `Invoice total ${Number(row.total || 0).toLocaleString()} • ${row.status || "Unpaid"}`,
        status: row.status || "",
        metadata: {
          invoiceId: row._id,
          encounterId: row.encounter || null,
        },
      })
    );
  });

  transfers.forEach((row) => {
    const patient = patientMap.get(String(row.patient));
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    items.push(
      timelineItem({
        type: "TRANSFER",
        occurredAt: row.updatedAt || row.createdAt,
        patient,
        patientView: view,
        title: "Care transfer updated",
        detail: row.reasons || "Transfer workflow status changed.",
        status: row.status || "",
        metadata: {
          transferId: row._id,
          fromHospital: row.fromHospital || null,
          toHospital: row.toHospital || null,
        },
      })
    );
  });

  vaccinationRecords.forEach((row) => {
    const patient = patientNameKeyMap.get(
      `${String(row.hospital || "")}::${String(row.memberName || "").toLowerCase()}`
    );
    if (!patient) return;
    const view = patientViews.get(String(patient._id));
    items.push(
      timelineItem({
        type: "VACCINATION",
        occurredAt: row.administeredAt || row.createdAt,
        patient,
        patientView: view,
        title: `${row.vaccine || "Vaccination"} recorded`,
        detail: row.dose ? `Dose ${row.dose}` : "Vaccination event recorded.",
        status: row.coldChainStatus || "",
        metadata: {
          vaccinationId: row._id,
          matchMode: "NAME_AND_HOSPITAL",
        },
      })
    );
  });

  const sortedItems = items
    .map((item) => ({
      ...item,
      occurredAt: toDate(item.occurredAt) || toDate(item.metadata?.createdAt) || new Date(0),
    }))
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, familyLimit);

  return {
    members: familyMembers,
    items: sortedItems,
  };
}
