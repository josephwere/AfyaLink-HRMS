import "../config/loadEnv.js";
import { neuroedgeGatewayClient, NeuroEdgeGatewayError } from "./neuroedgeGatewayClient.js";

const NEUROEDGE_KEY = process.env.NEUROEDGE_API_KEY || "";

const TEXT_MIME_RE = /^(text\/|application\/(json|xml|csv)|image\/svg\+xml)/i;
const TEXT_EXTENSION_RE = /\.(txt|csv|json|md|markdown|xml|html?|log)$/i;
const MAX_TEXT_EXTRACT_CHARS = 16000;


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

function normalizeAssistantPayload(payload = {}) {
  const request = payload?.request || {
    message: String(payload?.message || "").trim(),
    userMessage: String(payload?.userMessage || payload?.message || "").trim(),
    pageContext: String(payload?.pageContext || "").trim(),
    channel: String(payload?.channel || "web").trim(),
    client: String(payload?.client || "browser").trim(),
  };

  return {
    request,
    aiContext: payload?.aiContext || payload?.assistantContext || {},
    role: String(payload?.role || payload?.request?.role || payload?.aiContext?.actor?.role || "USER").trim(),
    healthProfile: payload?.healthProfile || payload?.aiContext?.actor?.healthProfile || {},
    rawPayload: payload,
  };
}

function buildNeuroEdgeRequestContract({ request, aiContext, role, healthProfile } = {}) {
  const safeRequest = {
    ...request,
    message: String(request?.message || "").trim(),
    userMessage: String(request?.userMessage || request?.message || "").trim(),
    pageContext: String(request?.pageContext || "").trim(),
    channel: String(request?.channel || "web").trim(),
    client: String(request?.client || "browser").trim(),
  };

  const workspace = aiContext?.workspace || {};
  const actor = aiContext?.actor || {};
  const subject = aiContext?.subject || {};
  const events = Array.isArray(aiContext?.events) ? aiContext.events.slice(0, 25) : [];
  const conversation = Array.isArray(aiContext?.conversation) ? aiContext.conversation.slice(-20) : [];

  return {
    session: {
      locale: String(workspace?.language || "en").toLowerCase(),
      organizationId: workspace?.organizationId || null,
      hospitalId: workspace?.hospitalId || null,
      channel: safeRequest.channel,
      client: safeRequest.client,
      timestamp: new Date().toISOString(),
    },
    actor: {
      id: actor?.id || null,
      role: String(role || actor?.role || "USER").toUpperCase(),
      permissions: Array.isArray(actor?.permissions) ? actor.permissions : [],
      preferences: actor?.preferences || {},
      healthProfile: healthProfile || {},
    },
    subject: {
      ...subject,
    },
    workspace: {
      ...workspace,
    },
    permissions: Array.isArray(actor?.permissions) ? actor.permissions : [],
    events,
    conversation,
    request: safeRequest,
  };
}

function buildNeuroEdgePayload({ requestContract } = {}) {
  return {
    request: requestContract.request,
    context: {
      session: requestContract.session,
      actor: requestContract.actor,
      subject: requestContract.subject,
      workspace: requestContract.workspace,
      permissions: requestContract.permissions,
      events: requestContract.events,
      conversation: requestContract.conversation,
    },
    metadata: {
      source: "afyalink",
      timestamp: new Date().toISOString(),
    },
  };
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

function buildNeuroEdgeCapabilityPayload({ capability, payload = {}, aiContext = {}, role = "USER", healthProfile = {} } = {}) {
  const requestPayload = {
    capability: String(capability || "").trim(),
    ...payload,
  };

  const requestContract = buildNeuroEdgeRequestContract({
    request: requestPayload,
    aiContext,
    role: String(role || aiContext?.actor?.role || "USER").trim(),
    healthProfile: healthProfile || aiContext?.actor?.healthProfile || {},
  });

  return buildNeuroEdgePayload({ requestContract });
}

async function runNeuroEdgeRequest(payload) {
  try {
    const response = await neuroedgeGatewayClient.chatCompletions(payload);
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

async function runNeuroEdgeRequestStream(payload, { onChunk } = {}) {
  try {
    const response = await neuroedgeGatewayClient.chatStream(payload, { onChunk });
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

export async function diagnoseSymptoms(symptoms, aiContext = {}) {
  if (hasNeuroEdge()) {
    const payloadBody = buildNeuroEdgeCapabilityPayload({
      capability: "diagnoseSymptoms",
      payload: { symptoms: Array.isArray(symptoms) ? symptoms : [symptoms] },
      aiContext,
    });

    const out = await runNeuroEdgeRequest(payloadBody);
    return {
      provider: out.provider,
      text: out.text || "No response generated.",
      degraded: out.degraded === true,
      code: out.code || "",
      retryAfterMs: Number(out.retryAfterMs || 0),
    };
  }

  return { provider: "unavailable", placeholder: true, symptoms };
}

export async function treatmentGuidelines(condition, aiContext = {}) {
  if (hasNeuroEdge()) {
    const payloadBody = buildNeuroEdgeCapabilityPayload({
      capability: "treatmentGuidelines",
      payload: { condition: String(condition || "") },
      aiContext,
    });

    const out = await runNeuroEdgeRequest(payloadBody);
    return {
      provider: out.provider,
      text: out.text || "No response generated.",
      degraded: out.degraded === true,
      code: out.code || "",
      retryAfterMs: Number(out.retryAfterMs || 0),
    };
  }

  return { provider: "unavailable", placeholder: true, condition };
}

export async function transcribeAudioBase64(b64) {
  if (hasNeuroEdge()) {
    return {
      provider: "neuroedge",
      capability: "audio-transcription",
      text: buildUnsupportedCapabilityMessage("audio transcription"),
      placeholder: true,
      sizeBytes: Buffer.byteLength(String(b64 || ""), "utf8"),
    };
  }

  return { provider: "unavailable", placeholder: true };
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

    const response = await neuroedgeGatewayClient.extract({
      contentBase64: String(contentBase64 || ""),
      mimeType: String(mimeType || "").trim(),
      filename: String(filename || "").trim(),
      metadata: { source: "afyalink" },
    });

    return {
      provider: "neuroedge",
      rawText: String(response?.rawText || "").slice(0, MAX_TEXT_EXTRACT_CHARS),
      summary: String(response?.summary || "").trim() || "Document extraction completed.",
      fields: response?.fields && typeof response.fields === "object" ? response.fields : {},
      rawResponse: response,
    };
  }

  return {
    provider: "none",
    rawText: "",
    summary: "No AI provider configured for document extraction",
    fields: {},
  };
}

export async function assistantChat(payload = {}) {
  const normalized = normalizeAssistantPayload(payload);
  const requestMessage = String(normalized.request.message || "").trim();
  if (!requestMessage) {
    throw new Error("message is required");
  }

  const requestContract = buildNeuroEdgeRequestContract(normalized);
  const payloadBody = buildNeuroEdgePayload({ requestContract });

  if (hasNeuroEdge()) {
    const out = await runNeuroEdgeRequest(payloadBody);
    return {
      provider: out.provider,
      text: out.text || "No response generated.",
      degraded: out.degraded === true,
      code: out.code || "",
      retryAfterMs: Number(out.retryAfterMs || 0),
    };
  }

  return {
    provider: "unavailable",
    text: "AI chat provider is not configured. Configure NEUROEDGE_API_KEY to enable assistant responses.",
  };
}

export async function assistantChatStream({ onChunk, ...payload } = {}) {
  const normalized = normalizeAssistantPayload(payload);
  const requestMessage = String(normalized.request.message || "").trim();
  if (!requestMessage) {
    throw new Error("message is required");
  }

  const requestContract = buildNeuroEdgeRequestContract(normalized);
  const payloadBody = buildNeuroEdgePayload({ requestContract });

  if (hasNeuroEdge()) {
    const out = await runNeuroEdgeRequestStream(payloadBody, { onChunk });
    return {
      provider: out.provider,
      text: out.text || "No response generated.",
      degraded: out.degraded === true,
      code: out.code || "",
      retryAfterMs: Number(out.retryAfterMs || 0),
    };
  }

  return {
    provider: "unavailable",
    text: "AI chat provider is not configured. Configure NEUROEDGE_API_KEY to enable assistant streaming.",
  };
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
    provider: "fallback",
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
