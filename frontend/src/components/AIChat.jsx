import React, { useRef, useState } from "react";
import { streamAssistantChat, submitAssistantFeedback } from "../services/assistantApi";

export default function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [feedbackByMessage, setFeedbackByMessage] = useState({});
  const messageSeedRef = useRef(0);

  const nextMessageId = (role = "message") => {
    messageSeedRef.current += 1;
    return `${role}-${Date.now()}-${messageSeedRef.current}`;
  };

  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    const pendingId = nextMessageId("assistant");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId("user"), role: "user", text: message },
      { id: pendingId, role: "assistant", text: "", pending: true, sourcePrompt: message },
    ]);
    setInput("");
    try {
      const out = await streamAssistantChat(
        { message, userMessage: message, pageContext: typeof window !== "undefined" ? window.location.pathname : "" },
        {
          onChunk: (delta) => {
            setMessages((prev) =>
              prev.map((entry) =>
                entry.id === pendingId
                  ? { ...entry, text: `${entry.text || ""}${String(delta || "")}`, pending: true }
                  : entry
              )
            );
          },
          onDone: ({ answer, provider }) => {
            setMessages((prev) =>
              prev.map((entry) =>
                entry.id === pendingId
                  ? {
                      ...entry,
                      text: answer || entry.text || "No response generated.",
                      provider,
                      pending: false,
                    }
                  : entry
              )
            );
          },
        }
      );
      if (!String(out?.answer || "").trim()) {
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === pendingId
              ? { ...entry, text: "No response generated.", provider: out?.provider || "unknown", pending: false }
              : entry
          )
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handleFeedback = async (entry, rating) => {
    const targetRating = rating === "down" ? "down" : "up";
    if (!entry?.id || !entry?.text || feedbackByMessage[entry.id]?.loading) return;
    setFeedbackByMessage((prev) => ({
      ...prev,
      [entry.id]: {
        savedRating: prev[entry.id]?.savedRating || "",
        loading: true,
      },
    }));
    try {
      await submitAssistantFeedback({
        rating: targetRating,
        message: entry.sourcePrompt || "",
        answer: entry.text,
        pageContext: typeof window !== "undefined" ? window.location.pathname : "",
      });
      setFeedbackByMessage((prev) => ({
        ...prev,
        [entry.id]: {
          savedRating: targetRating,
          loading: false,
        },
      }));
    } catch {
      setFeedbackByMessage((prev) => ({
        ...prev,
        [entry.id]: {
          savedRating: prev[entry.id]?.savedRating || "",
          loading: false,
        },
      }));
    }
  };

  return (
    <div className="premium-card mini-chat-shell">
      <div className="card-header-actions">
        <div>
          <h3>AI Chat</h3>
          <p className="muted">Lightweight assistant console for quick prompt-response flows.</p>
        </div>
      </div>

      <div className="mini-chat-log">
        {messages.length === 0 ? (
          <div className="premium-empty">
            <strong>No messages yet</strong>
            <span>Start a conversation to stream the assistant response here.</span>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={m.id || i}
              className={`mini-chat-bubble ${m.role === "user" ? "is-user" : "is-assistant"}${
                m.pending ? " is-streaming" : ""
              }`}
            >
              <strong>{m.role === "user" ? "You" : "AI"}</strong>
              <span>{m.pending && !m.text ? "NeuroEdge is preparing a response..." : m.text}</span>
              {m.role === "assistant" && m.text && !m.pending ? (
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
          ))
        )}
      </div>

      <div className="mini-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Describe symptoms or ask a question..."
        />
        <button type="button" className="btn-primary" onClick={send} disabled={sending || !input.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
