import apiFetch from "../utils/apiFetch";
import { fetchApiResponse } from "../lib/api/client";

export const getAssistantContext = () => apiFetch("/api/ai/assistant/context");

export const chatAssistant = (payload) =>
  apiFetch("/api/ai/assistant/chat", {
    method: "POST",
    body: payload || {},
  });

export async function streamAssistantChat(payload, { onChunk, onDone, onError } = {}) {
  const response = await fetchApiResponse("/api/ai/assistant/chat/stream", {
    method: "POST",
    body: payload || {},
    timeoutMs: 45000,
  });

  if (!response.body?.getReader) {
    const data = await response.json().catch(() => ({}));
    const answer = data?.answer || data?.text || "";
    if (answer) onChunk?.(answer, { final: true });
    onDone?.({
      answer,
      provider: data?.provider || "unknown",
    });
    return {
      answer,
      provider: data?.provider || "unknown",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let answer = "";
  let provider = "unknown";

  const flushLines = (flushRemainder = false) => {
    const lines = buffer.split(/\r?\n/);
    if (!flushRemainder) {
      buffer = lines.pop() ?? "";
    } else {
      buffer = "";
    }

    for (const line of lines) {
      const trimmed = String(line || "").trim();
      if (!trimmed) continue;
      let frame = null;
      try {
        frame = JSON.parse(trimmed);
      } catch {
        frame = { type: "chunk", delta: trimmed };
      }

      if (frame.type === "chunk") {
        const delta = String(frame.delta || "");
        if (!delta) continue;
        answer += delta;
        onChunk?.(delta, { answer, provider });
        continue;
      }

      if (frame.type === "done") {
        provider = frame.provider || provider;
        answer = String(frame.answer || answer || "").trim();
        onDone?.({ answer, provider });
        continue;
      }

      if (frame.type === "error") {
        const error = new Error(frame.message || "Assistant stream failed");
        onError?.(error);
        throw error;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushLines(false);
  }

  buffer += decoder.decode();
  flushLines(true);

  return { answer, provider };
}

export async function submitAssistantFeedback(payload) {
  const result = await apiFetch("/api/ai/assistant/feedback", {
    method: "POST",
    body: payload || {},
  });

  if (result?.success === true && result?.accepted === true) {
    return result;
  }

  const message =
    String(result?.message || "").trim() ||
    (result?.accepted === false
      ? "Feedback could not be saved right now. Please try again shortly."
      : "Failed to save feedback.");
  const error = new Error(message);
  error.data = result || null;
  throw error;
}

export const clearAssistantMemory = () =>
  apiFetch("/api/ai/assistant/clear-memory", {
    method: "POST",
  });

export const logAssistantAutofillAudit = (payload) =>
  apiFetch("/api/ai/assistant/autofill-audit", {
    method: "POST",
    body: payload || {},
  });
