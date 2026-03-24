import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";
import User from "../models/User.js";
import { resolveMinorConsentPolicy } from "./minorConsentPolicyService.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function isMinorDob(dob) {
  const age = calculateAge(dob);
  return age !== null && age < 18;
}

function toName(row) {
  return [row?.firstName, row?.lastName].filter(Boolean).join(" ").trim() || "Child patient";
}

function getMinorCutoffDate() {
  const now = new Date();
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
}

async function findNationalIdAnchoredMinorIds({ user, hospitalId = null, minorsOnly = false }) {
  const parentNationalIdNumber = String(user?.nationalIdNumber || "").trim().toUpperCase();
  if (!parentNationalIdNumber) return [];

  const where = {
    active: true,
    "familyGroup.parentNationalIdNumber": parentNationalIdNumber,
  };
  if (hospitalId) where.hospital = hospitalId;
  if (user?.nationalIdCountry) {
    where["familyGroup.parentNationalIdCountry"] = String(user.nationalIdCountry).trim().toUpperCase();
  }
  if (minorsOnly) {
    where.dob = { $gt: getMinorCutoffDate() };
  }

  return Patient.find(where).distinct("_id");
}

export async function countLinkedMinorsForUser(userOrId) {
  const user =
    userOrId && typeof userOrId === "object" && userOrId._id
      ? userOrId
      : await User.findById(userOrId).select(
          "nationalIdNumber nationalIdCountry familyMonitoring.linkedMinorPatients"
        );
  if (!user) return 0;

  const activeLinks = (user.familyMonitoring?.linkedMinorPatients || []).filter(
    (link) => String(link?.status || "ACTIVE").toUpperCase() === "ACTIVE" && link?.patient
  );
  const anchoredIds = await findNationalIdAnchoredMinorIds({ user, minorsOnly: true });

  return new Set([...activeLinks.map((link) => String(link.patient)), ...anchoredIds.map(String)]).size;
}

export async function resolvePatientIdsForUser(userId, hospitalId = null, options = {}) {
  const { includeLinkedMinors = true } = options;
  const user = await User.findById(userId).select(
    "name phone nationalIdNumber nationalIdCountry familyMonitoring.linkedMinorPatients"
  );
  if (!user) return [];

  const filters = [];
  if (user.nationalIdNumber) filters.push({ nationalId: user.nationalIdNumber });
  if (user.phone) filters.push({ contact: user.phone });
  filters.push({ "metadata.userId": userId });

  const directWhere = { active: true };
  if (filters.length) directWhere.$or = filters;
  if (hospitalId) directWhere.hospital = hospitalId;

  const directIds = filters.length
    ? await Patient.find(directWhere).distinct("_id")
    : [];

  let linkedIds = [];
  if (includeLinkedMinors) {
    const candidateIds = (user.familyMonitoring?.linkedMinorPatients || [])
      .filter((link) => String(link?.status || "ACTIVE").toUpperCase() === "ACTIVE")
      .map((link) => link.patient)
      .filter(Boolean);
    if (candidateIds.length) {
      const linkedWhere = { _id: { $in: candidateIds }, active: true };
      if (hospitalId) linkedWhere.hospital = hospitalId;
      linkedIds = await Patient.find(linkedWhere).distinct("_id");
    }
  }

  const anchoredIds = includeLinkedMinors
    ? await findNationalIdAnchoredMinorIds({ user, hospitalId })
    : [];

  return [...new Set([...directIds, ...linkedIds, ...anchoredIds].map((id) => String(id)))];
}

export async function buildLinkedMinorSummariesForUser(userId) {
  const user = await User.findById(userId).select(
    "nationalIdNumber nationalIdCountry familyMonitoring.linkedMinorPatients"
  );
  if (!user) return [];

  const activeLinks = (user.familyMonitoring?.linkedMinorPatients || []).filter(
    (link) => String(link?.status || "ACTIVE").toUpperCase() === "ACTIVE" && link?.patient
  );
  const explicitLinkMap = new Map(activeLinks.map((link) => [String(link.patient), link]));
  const anchoredIds = await findNationalIdAnchoredMinorIds({ user, minorsOnly: true });
  const patientIds = [...new Set([...activeLinks.map((link) => link.patient), ...anchoredIds].map(String))];
  if (!patientIds.length) return [];
  const now = new Date();
  const systemSettings = await getSystemSettingsDoc({ lean: true });

  const [patients, appointmentStats, encounterStats, prescriptionStats] = await Promise.all([
    Patient.find({ _id: { $in: patientIds }, active: true })
      .populate("hospital", "name")
      .select("firstName lastName dob gender hospital medicalRecords familyGroup updatedAt countryId")
      .lean(),
    Appointment.aggregate([
      { $match: { patient: { $in: patientIds }, status: { $ne: "Cancelled" } } },
      { $sort: { scheduledAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$patient",
          latestAppointmentAt: { $first: "$scheduledAt" },
          latestAppointmentStatus: { $first: "$status" },
          latestServiceType: { $first: "$serviceType" },
          upcomingAppointments: {
            $sum: {
              $cond: [{ $gt: ["$scheduledAt", now] }, 1, 0],
            },
          },
        },
      },
    ]),
    Encounter.aggregate([
      { $match: { patient: { $in: patientIds } } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$patient",
          totalEncounters: { $sum: 1 },
          latestEncounterAt: { $first: "$createdAt" },
          latestDiagnosis: { $first: "$diagnosis" },
          latestEncounterState: { $first: "$state" },
        },
      },
    ]),
    Prescription.aggregate([
      { $match: { patientRecord: { $in: patientIds }, status: { $ne: "CANCELLED" } } },
      {
        $group: {
          _id: "$patientRecord",
          activePrescriptions: { $sum: 1 },
          latestPrescriptionAt: { $max: "$createdAt" },
        },
      },
    ]),
  ]);

  const patientMap = new Map(patients.map((row) => [String(row._id), row]));
  const appointmentMap = new Map(appointmentStats.map((row) => [String(row._id), row]));
  const encounterMap = new Map(encounterStats.map((row) => [String(row._id), row]));
  const prescriptionMap = new Map(prescriptionStats.map((row) => [String(row._id), row]));

  const linkedPatients = patientIds
    .map((patientId) => {
      const patient = patientMap.get(String(patientId));
      if (!patient || !isMinorDob(patient.dob)) return null;
      const link = explicitLinkMap.get(String(patientId));
      const implicitRelationship = patient.familyGroup?.relationship || "PARENT";
      const appointments = appointmentMap.get(String(patientId)) || {};
      const encounters = encounterMap.get(String(patientId)) || {};
      const prescriptions = prescriptionMap.get(String(patientId)) || {};
      const age = calculateAge(patient.dob);
      const consentPolicy = resolveMinorConsentPolicy({
        age,
        countryCode:
          patient.familyGroup?.parentNationalIdCountry ||
          patient.countryId ||
          user.nationalIdCountry ||
          "",
        settings: systemSettings,
      });
      return {
        patientId: patient._id,
        name: toName(patient),
        firstName: patient.firstName || "",
        lastName: patient.lastName || "",
        dob: patient.dob || null,
        age,
        gender: patient.gender || "",
        relationship: link?.relationship || implicitRelationship,
        linkedAt: link?.linkedAt || patient.familyGroup?.verifiedAt || null,
        notes: link?.notes || patient.familyGroup?.notes || "",
        hospitalId: patient.hospital?._id || patient.hospital || null,
        hospitalName: patient.hospital?.name || "",
        medicalRecordsCount: Array.isArray(patient.medicalRecords) ? patient.medicalRecords.length : 0,
        upcomingAppointments: Number(appointments.upcomingAppointments || 0),
        latestAppointmentAt: appointments.latestAppointmentAt || null,
        latestAppointmentStatus: appointments.latestAppointmentStatus || "",
        latestServiceType: appointments.latestServiceType || "",
        totalEncounters: Number(encounters.totalEncounters || 0),
        latestEncounterAt: encounters.latestEncounterAt || null,
        latestDiagnosis: encounters.latestDiagnosis || "",
        latestEncounterState: encounters.latestEncounterState || "",
        activePrescriptions: Number(prescriptions.activePrescriptions || 0),
        latestPrescriptionAt: prescriptions.latestPrescriptionAt || null,
        consentPolicy,
        lastUpdatedAt:
          appointments.latestAppointmentAt ||
          encounters.latestEncounterAt ||
          prescriptions.latestPrescriptionAt ||
          patient.updatedAt ||
          null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastUpdatedAt || 0) - new Date(a.lastUpdatedAt || 0));

  return linkedPatients;
}

export async function searchMinorPatientsForGuardian({
  user,
  query,
  dob,
  hospitalId = null,
  limit = 10,
}) {
  const scopedHospitalId = hospitalId || user?.hospital || null;
  if (!scopedHospitalId) {
    return [];
  }

  const trimmedQuery = String(query || "").trim();
  const parsedDob = dob ? new Date(dob) : null;
  if (!trimmedQuery || !parsedDob || Number.isNaN(parsedDob.getTime())) {
    return [];
  }

  const dobStart = new Date(parsedDob);
  dobStart.setHours(0, 0, 0, 0);
  const dobEnd = new Date(parsedDob);
  dobEnd.setHours(23, 59, 59, 999);

  const linkedIds = new Set(
    (user?.familyMonitoring?.linkedMinorPatients || [])
      .filter((link) => String(link?.status || "ACTIVE").toUpperCase() === "ACTIVE")
      .map((link) => String(link.patient || ""))
      .filter(Boolean)
  );

  const nameRegex = new RegExp(escapeRegex(trimmedQuery), "i");
  const rows = await Patient.find({
    hospital: scopedHospitalId,
    active: true,
    dob: { $gte: dobStart, $lte: dobEnd },
    $or: [{ firstName: nameRegex }, { lastName: nameRegex }],
  })
    .populate("hospital", "name")
    .select("firstName lastName dob gender hospital guardianLinks")
    .limit(limit);

  return rows
    .filter((row) => isMinorDob(row.dob))
    .map((row) => ({
      patientId: row._id,
      name: toName(row),
      dob: row.dob,
      age: calculateAge(row.dob),
      gender: row.gender || "",
      hospitalId: row.hospital?._id || row.hospital || null,
      hospitalName: row.hospital?.name || "",
      alreadyLinked: linkedIds.has(String(row._id)),
    }));
}
