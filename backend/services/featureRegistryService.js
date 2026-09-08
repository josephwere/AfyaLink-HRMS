import { FEATURE_CODES, FEATURE_CODE_ALIASES } from "../constants/featureCodes.js";

const featureDefinitions = [
  { key: FEATURE_CODES.AI_CHAT, label: "AI Medical Assistant", billable: true, metered: true, core: false, serviceCode: "AI_REQUEST" },
  { key: FEATURE_CODES.AI_DIAGNOSIS, label: "AI Diagnosis", billable: true, metered: true, core: false, serviceCode: "AI_REQUEST" },
  { key: FEATURE_CODES.AI_TRIAGE, label: "AI Triage", billable: true, metered: true, core: false, serviceCode: "AI_REQUEST" },
  { key: FEATURE_CODES.PATIENT_SMS, label: "Patient SMS", billable: true, metered: true, core: false, serviceCode: "COMMUNICATION_MESSAGE" },
  { key: FEATURE_CODES.EMAIL_NOTIFICATION, label: "Email Notification", billable: true, metered: true, core: false, serviceCode: "COMMUNICATION_MESSAGE" },
  { key: FEATURE_CODES.WHATSAPP_NOTIFICATION, label: "WhatsApp Notification", billable: true, metered: true, core: false, serviceCode: "COMMUNICATION_MESSAGE" },
  { key: FEATURE_CODES.OCR_DOCUMENT_SCAN, label: "OCR Document Scan", billable: true, metered: true, core: false, serviceCode: "DOCUMENT_OCR" },
  { key: FEATURE_CODES.VOICE_DICTATION, label: "Voice Dictation", billable: true, metered: true, core: false, serviceCode: "VOICE_ANALYTICS" },
  { key: FEATURE_CODES.CLOUD_STORAGE_GB, label: "Cloud Storage", billable: true, metered: true, core: false, serviceCode: "CLOUD_STORAGE" },
  { key: FEATURE_CODES.VIDEO_CONSULTATION, label: "Video Consultation", billable: true, metered: true, core: false, serviceCode: "VIDEO_CONSULT" },
  { key: FEATURE_CODES.APPOINTMENT_BOOKING, label: "Appointment Booking", billable: false, metered: false, core: true, serviceCode: "APPOINTMENTS" },
  { key: FEATURE_CODES.LAB_TEST, label: "Lab Test", billable: false, metered: false, core: true, serviceCode: "LABORATORY" },
  { key: FEATURE_CODES.PRESCRIPTION, label: "Prescription", billable: false, metered: false, core: true, serviceCode: "PHARMACY" },
  { key: FEATURE_CODES.PHARMACY_DISPENSE, label: "Pharmacy Dispense", billable: false, metered: false, core: true, serviceCode: "PHARMACY" },
];

const registryMap = new Map(featureDefinitions.map((entry) => [entry.key, entry]));

export function getFeatureDefinitions() {
  return featureDefinitions;
}

export function getFeatureDefinition({ key }) {
  return registryMap.get(key) || null;
}

export function resolveFeatureCode(featureKey) {
  if (!featureKey) return null;
  const normalized = String(featureKey).trim().toUpperCase();
  if (registryMap.has(normalized)) return normalized;
  return FEATURE_CODE_ALIASES[normalized] || null;
}
