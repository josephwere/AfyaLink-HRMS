import {
  diagnoseSymptoms,
  treatmentGuidelines,
  transcribeAudioBase64,
} from "./aiAdapter.js";

export { diagnoseSymptoms, treatmentGuidelines };

export async function dischargeSummary(data) {
  const text = `Prepare a concise discharge summary for the following case: ${JSON.stringify(
    data || {}
  )}`;
  return diagnoseSymptoms([text]);
}

export async function transcribeAudioBase64Compat(b64, _options = {}) {
  return transcribeAudioBase64(b64);
}

export { transcribeAudioBase64Compat as transcribeAudioBase64 };

export async function triage(symptoms) {
  return diagnoseSymptoms(symptoms);
}

export default {
  diagnoseSymptoms,
  treatmentGuidelines,
  dischargeSummary,
  transcribeAudioBase64: transcribeAudioBase64Compat,
  triage,
};
