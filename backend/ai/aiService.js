import neuro from './neuroedgeClient.js';

export async function diagnose(symptoms) {
  return await neuro.diagnoseSymptoms(symptoms);
}

export async function triage(symptoms) {
  return await neuro.triage(symptoms);
}

export async function discharge(data) {
  return await neuro.dischargeSummary(data);
}

export async function transcribe(bufferBase64) {
  return await neuro.transcribeAudio(bufferBase64);
}

export default { diagnose, triage, discharge, transcribe };
