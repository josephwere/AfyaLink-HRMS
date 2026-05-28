import "../config/loadEnv.js";
import { neuroedgeGatewayClient } from "./neuroedgeGatewayClient.js";

const NEUROEDGE_KEY = process.env.NEUROEDGE_API_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const NEUROEDGE_CHAT_MODEL = String(process.env.NEUROEDGE_CHAT_MODEL || "").trim();
let openAiClientPromise = null;

const TEXT_MIME_RE = /^(text\/|application\/(json|xml|csv)|image\/svg\+xml)/i;
const TEXT_EXTENSION_RE = /\.(txt|csv|json|md|markdown|xml|html?|log)$/i;
const MAX_TEXT_EXTRACT_CHARS = 16000;

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

function hasNeuroEdge() {
  return Boolean(NEUROEDGE_KEY);
}

function extractCompletionText(payload) {
  if (!payload) return "";

  const direct =
    payload?.text ||
    payload?.answer ||
    payload?.message ||
    payload?.output_text ||
    payload?.content;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent.trim();
  }
  if (Array.isArray(messageContent)) {
    const combined = messageContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          return part.text || part.content || "";
        }
        return "";
      })
      .join("\n")
      .trim();
    if (combined) return combined;
  }

  const choiceText = payload?.choices?.[0]?.text;
  if (typeof choiceText === "string" && choiceText.trim()) {
    return choiceText.trim();
  }

  return "";
}

function buildChatPayload(messages) {
  const payload = { messages };
  if (NEUROEDGE_CHAT_MODEL) {
    payload.model = NEUROEDGE_CHAT_MODEL;
  }
  return payload;
}

async function runNeuroEdgeChat(messages) {
  const response = await neuroedgeGatewayClient.chatCompletions(buildChatPayload(messages));
  return {
    provider: "neuroedge",
    raw: response,
    text: extractCompletionText(response),
  };
}

async function callOpenAI(prompt, opts = {}) {
  const client = await getOpenAiClient();
  const resp = await client.chat.completions.create({
    model: opts.model || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: opts.max_tokens || 512,
    temperature: opts.temperature ?? 0.2,
  });
  return resp.choices?.[0]?.message?.content ?? "";
}

function isTextLikeDocument({ mimeType, filename }) {
  return TEXT_MIME_RE.test(String(mimeType || "")) || TEXT_EXTENSION_RE.test(String(filename || ""));
}

function decodeBase64Utf8(contentBase64) {
  try {
    return Buffer.from(String(contentBase64 || ""), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractJsonBlock(text) {
  const safe = String(text || "").trim();
  if (!safe) return null;
  try {
    return JSON.parse(safe);
  } catch {
    const start = safe.indexOf("{");
    const end = safe.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(safe.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildUnsupportedCapabilityMessage(capability) {
  return `NeuroEdge pilot chat is connected, but ${capability} is not enabled on this API contract yet.`;
}

export async function diagnoseSymptoms(symptoms) {
  if (hasNeuroEdge()) {
    const prompt = [
      "You are a cautious medical triage assistant inside AfyaLink.",
      "Do not claim certainty or provide a final diagnosis.",
      "Respond with three short sections: Summary, Possible concerns, Next safe steps.",
      `Symptoms: ${JSON.stringify(symptoms || [])}`,
    ].join("\n");
    const out = await runNeuroEdgeChat([
      { role: "system", content: "You provide safe, concise medical triage guidance." },
      { role: "user", content: prompt },
    ]);
    return { provider: out.provider, text: out.text || "No response generated." };
  }

  if (OPENAI_KEY) {
    const prompt = `You are a medical assistant. Given symptoms: ${JSON.stringify(
      symptoms
    )}. Provide top differential diagnoses (3) and recommended next steps.`;
    const txt = await callOpenAI(prompt, { max_tokens: 600 });
    return { provider: "openai", text: txt };
  }

  return { placeholder: true, symptoms };
}

export async function treatmentGuidelines(condition) {
  if (hasNeuroEdge()) {
    const out = await runNeuroEdgeChat([
      {
        role: "system",
        content: "You provide concise, evidence-aligned treatment guidance with explicit caution to confirm with a licensed clinician.",
      },
      {
        role: "user",
        content: `Provide practical treatment guidance and follow-up considerations for: ${String(
          condition || ""
        )}`,
      },
    ]);
    return { provider: out.provider, text: out.text || "No response generated." };
  }

  if (OPENAI_KEY) {
    const prompt = `Provide evidence-based treatment guidelines for: ${condition}`;
    const txt = await callOpenAI(prompt, { max_tokens: 400 });
    return { provider: "openai", text: txt };
  }

  return { placeholder: true, condition };
}

export async function transcribeAudioBase64(b64) {
  if (hasNeuroEdge()) {
    return {
      provider: "neuroedge",
      capability: "chat-completions",
      text: buildUnsupportedCapabilityMessage("audio transcription"),
      placeholder: true,
      sizeBytes: Buffer.byteLength(String(b64 || ""), "utf8"),
    };
  }

  if (OPENAI_KEY) {
    return {
      provider: "openai-fallback",
      text: "Transcription using OpenAI is not enabled in this backend yet.",
      placeholder: true,
    };
  }

  return { placeholder: true };
}

export async function extractDocumentBase64({ contentBase64, mimeType, filename }) {
  if (hasNeuroEdge()) {
    if (!isTextLikeDocument({ mimeType, filename })) {
      return {
        provider: "neuroedge",
        rawText: "",
        summary: buildUnsupportedCapabilityMessage(`document extraction for ${mimeType || "this file type"}`),
        fields: {},
        placeholder: true,
      };
    }

    const rawText = decodeBase64Utf8(contentBase64).slice(0, MAX_TEXT_EXTRACT_CHARS);
    if (!rawText.trim()) {
      return {
        provider: "neuroedge",
        rawText: "",
        summary: "This text document could not be decoded into readable UTF-8 content.",
        fields: {},
      };
    }

    const prompt = [
      "Review the following document text and return JSON only.",
      'Schema: {"rawText":"string","summary":"string","fields":{"documentType":"string","entities":["..."],"dates":["..."],"identifiers":["..."]}}',
      "Keep rawText concise and preserve the most useful readable content.",
      `Filename: ${filename || "unknown"}`,
      `MimeType: ${mimeType || "text/plain"}`,
      "",
      rawText,
    ].join("\n");

    const out = await runNeuroEdgeChat([
      { role: "system", content: "You extract structured fields from text documents and answer with valid JSON only." },
      { role: "user", content: prompt },
    ]);

    const parsed = extractJsonBlock(out.text);
    if (parsed && typeof parsed === "object") {
      return {
        provider: out.provider,
        rawText: String(parsed.rawText || rawText).slice(0, MAX_TEXT_EXTRACT_CHARS),
        summary: String(parsed.summary || "").trim() || "Structured extraction completed.",
        fields: parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {},
      };
    }

    return {
      provider: out.provider,
      rawText,
      summary: out.text || "Structured extraction completed.",
      fields: {},
    };
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

  if (hasNeuroEdge()) {
    const out = await runNeuroEdgeChat([
      {
        role: "system",
        content: [
          "You are NeuroEdge Personal Assistant inside AfyaLink.",
          "Be concise, practical, and safe.",
          "If medical risk appears high, advise seeking clinician or emergency help.",
          "Never claim diagnosis certainty.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `User role: ${safeRole}`,
          `Health profile: ${JSON.stringify(safeHealth)}`,
          `Page context: ${safePage || "N/A"}`,
          `User message: ${safeMessage}`,
        ].join("\n"),
      },
    ]);
    return { provider: out.provider, text: out.text || "No response generated." };
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
