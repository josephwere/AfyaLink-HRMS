import React, { useEffect, useRef, useState } from "react";
import { streamAssistantChat, submitAssistantFeedback } from "../services/assistantApi";
import { useAIContext } from "../context/AIContextProvider";

export default function AIChatWS({ messages: externalMessages, setMessages: externalSetMessages, input: externalInput, setInput: externalSetInput, presetPrompt = "", pageContext = "" }) {
  const [localMessages, setLocalMessages] = useState([]);
  const [localInput, setLocalInput] = useState("");
  const messages = externalMessages || localMessages;
  const setMessages = externalSetMessages || setLocalMessages;
  const input = typeof externalInput === "string" ? externalInput : localInput;
  const setInput = externalSetInput || setLocalInput;
  const { aiContext } = useAIContext();
  const [feedbackByMessage, setFeedbackByMessage] = useState({});
  const [status, setStatus] = useState("");
  const streamIdRef = useRef("");
  const logRef = useRef(null);
  const messageSeedRef = useRef(0);

  const nextMessageId = (from = "message") => {
    messageSeedRef.current += 1;
    return `${from}-${Date.now()}-${messageSeedRef.current}`;
  };

  useEffect(() => {
    if (!presetPrompt) return;
    setInput(presetPrompt);
  }, [presetPrompt]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const awaitingReply = Boolean(messages[messages.length - 1]?.streaming);

  const finalizePendingMessage = (id, text, provider = "unknown") => {
    const finalText = String(text || "").trim() || "No response generated.";
    setMessages((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              text: finalText,
              provider,
              streaming: false,
            }
          : entry
      )
    );
    streamIdRef.current = "";
  };

  const appendPendingChunk = (id, delta) => {
    const chunk = String(delta || "");
    if (!chunk) return;
    setMessages((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              text: `${entry.text || ""}${chunk}`,
              streaming: true,
            }
          : entry
      )
    );
  };

  const send = async () => {
    const prompt = String(input || "").trim();
    if (!prompt || awaitingReply) return;

    const pendingId = nextMessageId("ai");
    streamIdRef.current = pendingId;
    setStatus("");
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId("user"), from: "user", text: prompt, streaming: false },
      {
        id: pendingId,
        from: "ai",
        text: "",
        streaming: true,
        sourcePrompt: prompt,
        provider: "",
      },
    ]);
    setInput("");

    try {
      const routeContext = pageContext || (typeof window !== "undefined" ? window.location.pathname : "medical-assistant");
      const out = await streamAssistantChat(
        {
          request: {
            message: prompt,
            userMessage: prompt,
            pageContext: routeContext,
            channel: "web",
            client: "browser",
          },
          aiContext: {
            ...aiContext,
            pageContext: routeContext,
          },
        },
        {
          onChunk: (delta) => appendPendingChunk(pendingId, delta),
          onDone: ({ answer, provider }) => finalizePendingMessage(pendingId, answer, provider),
        }
      );

      if (!String(out?.answer || "").trim()) {
        finalizePendingMessage(pendingId, "No response generated.", out?.provider || "unknown");
      }
    } catch (err) {
      finalizePendingMessage(
        pendingId,
        err?.message || "Assistant stream is unavailable right now. Please try again shortly.",
        "fallback"
      );
      setStatus(err?.message || "Assistant stream is unavailable right now.");
    }
  };

  const handleFeedback = async (entry, rating) => {
    if (!entry?.id || !entry?.text) return;
    const targetRating = rating === "down" ? "down" : "up";
    const current = feedbackByMessage[entry.id];
    if (current?.loading || current?.savedRating === targetRating) return;

    setFeedbackByMessage((prev) => ({
      ...prev,
      [entry.id]: {
        savedRating: prev[entry.id]?.savedRating || "",
        loading: true,
        error: "",
      },
    }));

    try {
      await submitAssistantFeedback({
        rating: targetRating,
        message: entry.sourcePrompt || "",
        answer: entry.text,
        pageContext: typeof window !== "undefined" ? window.location.pathname : "medical-assistant",
      });
      setFeedbackByMessage((prev) => ({
        ...prev,
        [entry.id]: {
          savedRating: targetRating,
          loading: false,
          error: "",
        },
      }));
      setStatus(
        targetRating === "up"
          ? "Feedback received."
          : "Feedback received. We will review this reply."
      );
    } catch (err) {
      setFeedbackByMessage((prev) => ({
        ...prev,
        [entry.id]: {
          savedRating: prev[entry.id]?.savedRating || "",
          loading: false,
          error: err?.message || "Failed to save feedback.",
        },
      }));
      setStatus(err?.message || "Failed to save feedback.");
    }
  };

  return (
    <div className="mini-chat-shell">
      <div className="mini-chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <div
            key={m.id || i}
            className={`mini-chat-bubble${
              m.from === "user" ? " is-user" : m.from === "ai" ? " is-assistant" : ""
            }${m.streaming ? " is-streaming" : ""}`}
          >
            <strong>{m.from === "user" ? "You" : m.from === "ai" ? "NeuroEdge" : "System"}</strong>
            <span>{m.streaming && !m.text ? "NeuroEdge is preparing a response..." : m.text}</span>
            {m.from === "ai" && m.text && !m.streaming ? (
              <div className="mini-chat-feedback">
                <button
                  type="button"
                  className={`mini-chat-feedback-btn${
                    feedbackByMessage[m.id]?.savedRating === "up" ? " is-active" : ""
                  }`}
                  onClick={() => handleFeedback(m, "up")}
                  disabled={feedbackByMessage[m.id]?.loading}
                >
                  Helpful
                </button>
                <button
                  type="button"
                  className={`mini-chat-feedback-btn${
                    feedbackByMessage[m.id]?.savedRating === "down" ? " is-active" : ""
                  }`}
                  onClick={() => handleFeedback(m, "down")}
                  disabled={feedbackByMessage[m.id]?.loading}
                >
                  Needs work
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mini-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe symptoms or ask a workflow question..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="actions-row">
          <button type="button" className="btn-primary" onClick={send} disabled={awaitingReply || !input.trim()}>
            {awaitingReply ? "Waiting..." : "Ask AI"}
          </button>
        </div>
        {status ? <p className="muted">{status}</p> : null}
      </div>
    </div>
  );
}
