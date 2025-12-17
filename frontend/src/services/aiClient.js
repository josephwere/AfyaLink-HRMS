import API_BASE from "@/config/api";



export async function diagnose(symptoms) {
  const res = await fetch(`${API_BASE}/ai/diagnose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symptoms }),
  });

  return res.json();
}

export async function triage(symptoms) {
  const res = await fetch(`${API_BASE}/ai/triage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symptoms }),
  });

  return res.json();
}

export async function transcribeAudio(blob) {
  // placeholder: send multipart/form-data if needed
  return {
    placeholder: true,
    text: "Transcription will appear here.",
  };
}
