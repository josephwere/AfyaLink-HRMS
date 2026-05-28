import React, { useRef, useState } from "react";
import { fetchApiResponse } from "../lib/api/client";

export default function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const evtSourceRef = useRef(null);

  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    try {
      const res = await fetchApiResponse("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { message },
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        try {
          const parsed = JSON.parse(chunk.trim());
          assistantText += parsed.chunk ? parsed.chunk : chunk;
        } catch {
          assistantText += chunk;
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { role: "assistant", text: assistantText }];
          }
          return [...prev, { role: "assistant", text: assistantText }];
        });
      }
    } finally {
      setSending(false);
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
            <div key={i} className={`mini-chat-bubble ${m.role === "user" ? "is-user" : "is-assistant"}`}>
              <strong>{m.role === "user" ? "You" : "AI"}</strong>
              <span>{m.text}</span>
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
