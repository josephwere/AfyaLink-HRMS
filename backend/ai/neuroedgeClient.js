import fetch from 'node-fetch';

const NEUROEDGE_URL = process.env.NEUROEDGE_URL;
const NEUROEDGE_KEY = process.env.NEUROEDGE_KEY;

async function callNeuroEdge(endpoint, payload) {
  if (!NEUROEDGE_URL || !NEUROEDGE_KEY) return { placeholder: true, message: 'NeuroEdge not configured' };
  const res = await fetch(`${NEUROEDGE_URL}/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NEUROEDGE_KEY}` }, body: JSON.stringify(payload)
  });
  return res.json();
}

export async function diagnoseSymptoms(symptoms) {
  return await callNeuroEdge('diagnose', { symptoms });
}

export async function treatmentGuidelines(condition) {
  return await callNeuroEdge('treatment', { condition });
}

export async function dischargeSummary(data) {
  return await callNeuroEdge('discharge', data);
}

export async function transcribeAudio(bufferBase64) {
  return await callNeuroEdge('transcribe', { audio: bufferBase64 });
}

export async function triage(symptoms) {
  return await callNeuroEdge('triage', { symptoms });
}
export default { diagnoseSymptoms, treatmentGuidelines, dischargeSummary, transcribeAudio, triage };
