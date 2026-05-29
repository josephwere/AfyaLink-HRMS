import "../config/loadEnv.js";
import { neuroedgeGatewayClient, NeuroEdgeGatewayError } from "./neuroedgeGatewayClient.js";

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

function buildAssistantMessages({ message, role, pageContext, healthProfile }) {
  const safeRole = String(role || "USER");
  const safeMessage = String(message || "").trim();
  const safePage = String(pageContext || "").slice(0, 8000);
  const safeHealth = typeof healthProfile === "object" && healthProfile ? healthProfile : {};

  return [
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
  ];
}

function splitTextIntoChunks(text, maxChunkLength = 180) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  const flush = () => {
    const next = current.trim();
    if (next) chunks.push(next);
    current = "";
  };

  for (const sentence of sentences) {
    if ((`${current} ${sentence}`).trim().length <= maxChunkLength) {
      current = `${current} ${sentence}`.trim();
      continue;
    }
    flush();
    if (sentence.length <= maxChunkLength) {
      current = sentence;
      continue;
    }
    for (let cursor = 0; cursor < sentence.length; cursor += maxChunkLength) {
      chunks.push(sentence.slice(cursor, cursor + maxChunkLength));
    }
  }
  flush();
  return chunks.length ? chunks : [clean];
}

async function emitSyntheticChunks(text, onChunk) {
  const callback = typeof onChunk === "function" ? onChunk : null;
  if (!callback) return;
  for (const chunk of splitTextIntoChunks(text)) {
    callback(chunk, { synthetic: true });
    await Promise.resolve();
  }
}

function buildAssistantFeedbackPayload({ message, answer, rating, reason, metadata = {} }) {
  const normalizedRating = String(rating || "").toLowerCase() === "down" ? "down" : "up";
  return {
    category: "assistant_chat",
    rating: normalizedRating,
    score: normalizedRating === "up" ? 1 : -1,
    message: String(message || "").trim().slice(0, 4000),
    answer: String(answer || "").trim().slice(0, 12000),
    reason: String(reason || "").trim().slice(0, 1000),
    metadata:
      metadata && typeof metadata === "object"
        ? JSON.parse(JSON.stringify(metadata))
        : {},
  };
}

async function runNeuroEdgeChat(messages) {
  try {
    const response = await neuroedgeGatewayClient.chatCompletions(buildChatPayload(messages));
    return {
      provider: "neuroedge",
      raw: response,
      text: extractCompletionText(response),
    };
  } catch (error) {
    if (isRetryableNeuroEdgeError(error)) {
      return {
        provider: "neuroedge-rate-limited",
        degraded: true,
        code: error.code || "NEUROEDGE_RATE_LIMITED",
        retryAfterMs: getRetryAfterMs(error),
        text: buildAssistantRateLimitText(error),
      };
    }
    throw error;
  }
}

async function runNeuroEdgeChatStream(messages, { onChunk } = {}) {
  try {
    const response = await neuroedgeGatewayClient.chatStream(buildChatPayload(messages), { onChunk });
    return {
      provider: "neuroedge",
      raw: response,
      text: String(response?.text || extractCompletionText(response) || "").trim(),
    };
  } catch (error) {
    if (isRetryableNeuroEdgeError(error)) {
      const text = buildAssistantRateLimitText(error);
      await emitSyntheticChunks(text, onChunk);
      return {
        provider: "neuroedge-rate-limited",
        degraded: true,
        code: error.code || "NEUROEDGE_RATE_LIMITED",
        retryAfterMs: getRetryAfterMs(error),
        text,
      };
    }
    throw error;
  }
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

function isRetryableNeuroEdgeError(error) {
  if (!(error instanceof NeuroEdgeGatewayError)) return false;
  return (
    Number(error?.status || 0) === 429 ||
    error?.code === "NEUROEDGE_RATE_LIMITED" ||
    error?.code === "NEUROEDGE_CIRCUIT_OPEN"
  );
}

function getRetryAfterMs(error) {
  return Math.max(0, Number(error?.details?.retryAfterMs || 0));
}

function getRetryAfterSeconds(error) {
  const retryAfterMs = getRetryAfterMs(error);
  return retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0;
}

function buildAssistantRateLimitText(error) {
  const retryAfterSeconds = getRetryAfterSeconds(error);
  const retryText =
    retryAfterSeconds > 0
      ? `Please try again in about ${retryAfterSeconds} seconds.`
      : "Please try again shortly.";
  return [
    "Assistant service is busy right now.",
    retryText,
    "If you have urgent symptoms, contact a clinician immediately.",
  ].join(" ");
}

function buildFeedbackRateLimitMessage(error) {
  const retryAfterSeconds = getRetryAfterSeconds(error);
  if (retryAfterSeconds > 0) {
    return `Feedback could not be saved right now because NeuroEdge is busy. Please try again in about ${retryAfterSeconds} seconds.`;
  }
  return "Feedback could not be saved right now because NeuroEdge is busy. Please try again shortly.";
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
  const messages = buildAssistantMessages({ message, role, pageContext, healthProfile });

  if (hasNeuroEdge()) {
    const out = await runNeuroEdgeChat(messages);
    return {
      provider: out.provider,
      text: out.text || "No response generated.",
      degraded: out.degraded === true,
      code: out.code || "",
      retryAfterMs: Number(out.retryAfterMs || 0),
    };
  }

  if (OPENAI_KEY) {
    const prompt = [
      "You are NeuroEdge Personal Assistant inside AfyaLink.",
      "Rules:",
      "- Be concise and practical.",
      "- If medical risk appears high, advise seeking clinician/emergency help.",
      "- Never claim diagnosis certainty.",
      "",
      `User role: ${String(role || "USER")}`,
      `Health profile: ${JSON.stringify(healthProfile || {})}`,
      `Page context: ${String(pageContext || "").slice(0, 8000) || "N/A"}`,
      `User message: ${String(message || "").trim()}`,
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

export async function assistantChatStream({ message, role, pageContext, healthProfile, onChunk }) {
  const messages = buildAssistantMessages({ message, role, pageContext, healthProfile });

  if (hasNeuroEdge()) {
    const out = await runNeuroEdgeChatStream(messages, { onChunk });
    return {
      provider: out.provider,
      text: out.text || "No response generated.",
      degraded: out.degraded === true,
      code: out.code || "",
      retryAfterMs: Number(out.retryAfterMs || 0),
    };
  }

  const fallback = await assistantChat({ message, role, pageContext, healthProfile });
  await emitSyntheticChunks(fallback?.text || "", onChunk);
  return fallback;
}

export async function assistantFeedback({ message, answer, rating, reason, metadata = {} }) {
  const payload = buildAssistantFeedbackPayload({ message, answer, rating, reason, metadata });

  if (hasNeuroEdge()) {
    try {
      const response = await neuroedgeGatewayClient.feedback(payload);
      return {
        provider: "neuroedge",
        accepted: response?.accepted !== false,
        response,
      };
    } catch (error) {
      const status = Number(error?.status || 0);
      if (isRetryableNeuroEdgeError(error)) {
        return {
          provider: "neuroedge",
          accepted: false,
          degraded: true,
          retryable: true,
          reason: error?.code || "NEUROEDGE_RATE_LIMITED",
          message: buildFeedbackRateLimitMessage(error),
          retryAfterMs: getRetryAfterMs(error),
          retryAfterSeconds: getRetryAfterSeconds(error),
          response: error?.details || null,
        };
      }
      if ([404, 405, 422].includes(status)) {
        return {
          provider: "neuroedge",
          accepted: false,
          degraded: true,
          reason: error?.code || "NEUROEDGE_FEEDBACK_UNAVAILABLE",
          response: error?.details || null,
        };
      }
      throw error;
    }
  }

  return {
    provider: OPENAI_KEY ? "openai-fallback" : "fallback",
    accepted: false,
    degraded: true,
    reason: "FEEDBACK_CAPTURED_LOCALLY_ONLY",
    response: payload,
  };
}

export default {
  diagnoseSymptoms,
  treatmentGuidelines,
  transcribeAudioBase64,
  extractDocumentBase64,
  assistantChat,
  assistantChatStream,
  assistantFeedback,
};
