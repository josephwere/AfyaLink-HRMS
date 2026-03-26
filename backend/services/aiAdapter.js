import fetch from 'node-fetch';

const NEUROEDGE_KEY = process.env.NEUROEDGE_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
let openAiClientPromise = null;

async function getOpenAiClient() {
  if (!OPENAI_KEY) throw new Error("OpenAI key not configured");
  if (!openAiClientPromise) {
    openAiClientPromise = (async () => {
      const mod = await import("openai");
      const OpenAI = mod?.default || mod;
      return new OpenAI({ apiKey: OPENAI_KEY });
    })();
  }
  return openAiClientPromise;
}

async function callNeuroEdge(path, body){
  const BASE = process.env.NEUROEDGE_API_BASE || 'https://api.neuroedge.example/v1';
  if(!NEUROEDGE_KEY) throw new Error('NeuroEdge key not configured');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${NEUROEDGE_KEY}` },
    body: JSON.stringify(body),
    timeout: 120000
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function callOpenAI(prompt, opts = {}){
  const client = await getOpenAiClient();
  // Use chat completions for structured responses
  const resp = await client.chat.completions.create({
    model: opts.model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: opts.max_tokens || 512,
    temperature: opts.temperature ?? 0.2
  });
  // return text
  return resp.choices?.[0]?.message?.content ?? '';
}

export async function diagnoseSymptoms(symptoms){
  // Try NeuroEdge first, fallback to OpenAI if key present
  if(NEUROEDGE_KEY){
    return callNeuroEdge('/diagnose', { symptoms });
  }
  if(OPENAI_KEY){
    const prompt = `You are a medical assistant. Given symptoms: ${JSON.stringify(symptoms)}. Provide top differential diagnoses (3) and recommended next steps.`;
    const txt = await callOpenAI(prompt, { max_tokens: 600 });
    return { text: txt };
  }
  return { placeholder: true, symptoms };
}

export async function treatmentGuidelines(condition){
  if(NEUROEDGE_KEY) return callNeuroEdge('/treatment', { condition });
  if(OPENAI_KEY){
    const prompt = `Provide evidence-based treatment guidelines for: ${condition}`;
    const txt = await callOpenAI(prompt, { max_tokens: 400 });
    return { text: txt };
  }
  return { placeholder: true, condition };
}

export async function transcribeAudioBase64(b64){
  // If NeuroEdge supports transcription, use it; otherwise use OpenAI Whisper API if OPENAI_KEY present
  if(NEUROEDGE_KEY) return callNeuroEdge('/transcribe', { audio_b64: b64 });
  if(OPENAI_KEY){
    // OpenAI's speech to text would typically require file upload; leave placeholder instructing to use client-side
    return { text: 'Transcription using OpenAI not implemented in-node; please upload to NeuroEdge or configure streaming ASR' };
  }
  return { placeholder:true };
}

export async function extractDocumentBase64({ contentBase64, mimeType, filename }) {
  if (NEUROEDGE_KEY) {
    return callNeuroEdge("/extract", {
      content_b64: contentBase64,
      mime_type: mimeType,
      filename,
    });
  }
  if (OPENAI_KEY) {
    const prompt = [
      "Extract all readable raw text and key structured fields from this uploaded document.",
      `Filename: ${filename || "unknown"}`,
      `MimeType: ${mimeType || "application/octet-stream"}`,
      "If image/PDF parsing is not available, return best-effort summary and 'rawText' as empty.",
    ].join("\n");
    const txt = await callOpenAI(prompt, { max_tokens: 700 });
    return { provider: "openai-fallback", rawText: "", summary: txt, fields: {} };
  }
  return {
    provider: "none",
    rawText: "",
    summary: "No AI provider configured for document extraction",
    fields: {},
  };
}

export async function assistantChat({ message, role, pageContext, healthProfile }) {
  const safeRole = String(role || "USER");
  const safeMessage = String(message || "").trim();
  const safePage = String(pageContext || "").slice(0, 8000);
  const safeHealth = typeof healthProfile === "object" && healthProfile ? healthProfile : {};

  if (NEUROEDGE_KEY) {
    return callNeuroEdge("/assistant/chat", {
      message: safeMessage,
      role: safeRole,
      page_context: safePage,
      health_profile: safeHealth,
    });
  }

  if (OPENAI_KEY) {
    const prompt = [
      "You are NeuroEdge Personal Assistant inside AfyaLink.",
      "Rules:",
      "- Be concise and practical.",
      "- If medical risk appears high, advise seeking clinician/emergency help.",
      "- Never claim diagnosis certainty.",
      "",
      `User role: ${safeRole}`,
      `Health profile: ${JSON.stringify(safeHealth)}`,
      `Page context: ${safePage || "N/A"}`,
      `User message: ${safeMessage}`,
      "",
      "Respond with plain text and optional short bullets.",
    ].join("\n");

    const text = await callOpenAI(prompt, { max_tokens: 600, temperature: 0.2 });
    return { provider: "openai", text };
  }

  return {
    provider: "fallback",
    text:
      "AI chat provider is not configured. Configure NEUROEDGE_API_KEY or OPENAI_API_KEY to enable full assistant responses.",
  };
}

export default {
  diagnoseSymptoms,
  treatmentGuidelines,
  transcribeAudioBase64,
  extractDocumentBase64,
  assistantChat,
};
