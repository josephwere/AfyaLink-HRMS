import mongoose from "mongoose";

const idSequenceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: false }
);

const IdSequence = mongoose.models.IdSequence || mongoose.model("IdSequence", idSequenceSchema);

function formatEntityId(prefix, sequence, digits = 6) {
  return `AFY-${prefix}-${String(sequence).padStart(digits, "0")}`;
}

export async function nextSequence(sequenceName) {
  const counter = await IdSequence.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return counter.seq;
}

export async function generateId(prefix, digits = 6) {
  const seq = await nextSequence(prefix);
  return formatEntityId(prefix, seq, digits);
}

export async function generateUserId() {
  return generateId("USR");
}

export async function generateHospitalId() {
  return generateId("HSP");
}

export async function generatePatientId() {
  return generateId("PAT");
}

export async function generatePharmacyId() {
  return generateId("PHM");
}

export async function generateAppointmentId() {
  return generateId("APT");
}

export async function generateEncounterId() {
  return generateId("ENC");
}

export async function generatePrescriptionId() {
  return generateId("PRX");
}

export async function generateInvoiceId() {
  return generateId("INV");
}

export async function generatePaymentId() {
  return generateId("PAY");
}

export async function generateClaimId() {
  return generateId("CLM");
}

export async function generateLaboratoryRequestId() {
  return generateId("LAB");
}

export async function generateRadiologyRequestId() {
  return generateId("RAD");
}

export async function generateReferralId() {
  return generateId("REF");
}

export async function generateInsurancePolicyId() {
  return generateId("POL");
}
