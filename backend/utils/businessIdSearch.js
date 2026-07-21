/**
 * backend/utils/businessIdSearch.js
 * Utility for searching entities by business IDs (AFY-TYPE-000001 format)
 */

import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Hospital from "../models/Hospital.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import LabOrder from "../models/LabOrder.js";
import RadiologyStudy from "../models/RadiologyStudy.js";
import Claim from "../models/Claim.js";

/**
 * Parse a business ID and return type and sequence
 * Handles format: AFY-TYPE-000001
 */
export function parseBusinessId(businessId) {
  if (!businessId || typeof businessId !== "string") return null;
  
  const match = businessId.match(/^AFY-([A-Z]+)-(\d+)$/);
  if (!match) return null;
  
  return {
    type: match[1],
    sequence: parseInt(match[2], 10),
    original: businessId,
  };
}

/**
 * Find entity by business ID across all types
 */
export async function findByBusinessId(businessId) {
  const parsed = parseBusinessId(businessId);
  if (!parsed) return null;

  const { type, original } = parsed;

  switch (type) {
    case "USR":
      return { type: "user", model: "User", doc: await User.findOne({ userId: original }).lean() };
    case "PAT":
      return { type: "patient", model: "Patient", doc: await Patient.findOne({ patientId: original }).lean() };
    case "HSP":
      return { type: "hospital", model: "Hospital", doc: await Hospital.findOne({ hospitalId: original }).lean() };
    case "PHM":
      return { type: "pharmacy", model: "RegisteredPharmacy", doc: await RegisteredPharmacy.findOne({ pharmacyId: original }).lean() };
    case "APT":
      return { type: "appointment", model: "Appointment", doc: await Appointment.findOne({ appointmentId: original }).lean() };
    case "ENC":
      return { type: "encounter", model: "Encounter", doc: await Encounter.findOne({ encounterId: original }).lean() };
    case "PRX":
      return { type: "prescription", model: "Prescription", doc: await Prescription.findOne({ prescriptionId: original }).lean() };
    case "INV":
      return { type: "invoice", model: "Invoice", doc: await Invoice.findOne({ invoiceId: original }).lean() };
    case "LAB":
      return { type: "laboratory", model: "LabOrder", doc: await LabOrder.findOne({ laboratoryRequestId: original }).lean() };
    case "RAD":
      return { type: "radiology", model: "RadiologyStudy", doc: await RadiologyStudy.findOne({ radiologyRequestId: original }).lean() };
    case "CLM":
      return { type: "claim", model: "Claim", doc: await Claim.findOne({ claimId: original }).lean() };
    default:
      return null;
  }
}

/**
 * Build search query that looks for business IDs OR name/email patterns
 */
export function buildBusinessIdSearchFilter(query, allowedFields = [], fallbackClauses = []) {
  if (!query || typeof query !== "string") return {};

  const trimmed = query.trim();
  const isBusinessId = trimmed.match(/^AFY-[A-Z]+-\d+$/);

  if (isBusinessId) {
    if (!allowedFields.length) return {};
    return {
      $or: allowedFields.map((field) => ({ [field]: trimmed })),
    };
  }

  if (fallbackClauses.length) {
    return { $or: fallbackClauses };
  }

  return {};
}

/**
 * Extract business ID from any entity object
 */
export function getBusinessIdFromEntity(entity, entityType) {
  if (!entity) return null;

  const idFields = {
    user: "userId",
    patient: "patientId",
    hospital: "hospitalId",
    pharmacy: "pharmacyId",
    appointment: "appointmentId",
    encounter: "encounterId",
    prescription: "prescriptionId",
    invoice: "invoiceId",
    laboratory: "laboratoryRequestId",
    radiology: "radiologyRequestId",
    claim: "claimId",
    referral: "referralId",
  };

  const field = idFields[entityType];
  return field ? entity[field] : null;
}
