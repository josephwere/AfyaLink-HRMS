import apiFetch from "../utils/apiFetch";

export async function diagnose(symptoms) {
  return apiFetch("/api/triage/classify", {
    method: "POST",
    body: { symptoms },
  });
}

export async function triage(symptoms) {
  return apiFetch("/api/triage/classify", {
    method: "POST",
    body: { symptoms },
  });
}

export async function transcribeAudioBase64(audioBase64) {
  return apiFetch("/api/triage/transcribe", {
    method: "POST",
    body: { audioBase64 },
  });
}

export default {
  diagnose,
  triage,
  transcribeAudioBase64,
};
