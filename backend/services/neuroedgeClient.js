import fetch from 'node-fetch';

const BASE = process.env.NEUROEDGE_API_BASE || 'https://api.neuroedge.example/v1';
const API_KEY = process.env.NEUROEDGE_API_KEY || '';

async function callNeuroEdge(path, body = {}, method = 'POST') {
  if (!API_KEY) {
    return { placeholder: true, path, body };
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
    timeout: 120000
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NeuroEdge error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function diagnoseSymptoms(symptoms) {
  return callNeuroEdge('/diagnose', { symptoms });
}
export async function treatmentGuidelines(condition) {
  return callNeuroEdge('/treatment', { condition });
}
export async function dischargeSummary(data) {
  return callNeuroEdge('/discharge', { data });
}
export async function transcribeAudioBase64(b64, options = {}) {
  return callNeuroEdge('/transcribe', { audio_b64: b64, ...options });
}
export async function triage(symptoms) {
  return callNeuroEdge('/triage', { symptoms });
}

export default { diagnoseSymptoms, treatmentGuidelines, dischargeSummary, transcribeAudioBase64, triage };
