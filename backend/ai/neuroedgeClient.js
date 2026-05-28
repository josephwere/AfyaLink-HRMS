import {
  diagnoseSymptoms as diagnoseSymptomsAdapter,
  treatmentGuidelines as treatmentGuidelinesAdapter,
  transcribeAudioBase64 as transcribeAudioBase64Adapter,
} from "../services/aiAdapter.js";

export async function diagnoseSymptoms(symptoms) {
  return diagnoseSymptomsAdapter(symptoms);
}

export async function treatmentGuidelines(condition) {
  return treatmentGuidelinesAdapter(condition);
}

export async function dischargeSummary(data) {
  return diagnoseSymptomsAdapter([
    `Create a concise discharge summary from: ${JSON.stringify(data || {})}`,
  ]);
}

export async function transcribeAudio(bufferBase64) {
  return transcribeAudioBase64Adapter(bufferBase64);
}

export async function triage(symptoms) {
  return diagnoseSymptomsAdapter(symptoms);
}

export default {
  diagnoseSymptoms,
  treatmentGuidelines,
  dischargeSummary,
  transcribeAudio,
  triage,
};
