import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../utils/socket";
import { useAuth } from "../utils/auth";

export default function AIChatWS() {
  const socket = useSocket();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const streamIdRef = useRef("");
  const logRef = useRef(null);
  const messageSeedRef = useRef(0);

  const nextMessageId = (from = "message") => {
    messageSeedRef.current += 1;
    return `${from}-${Date.now()}-${messageSeedRef.current}`;
  };

  const pushMessage = (from, text, extras = {}) => {
    const clean = typeof text === "string" ? text : "";
    if (!clean.trim() && !extras.streaming) return;
    setMessages((prev) => [
      ...prev,
      {
        id: extras.id || nextMessageId(from),
        from,
        text: clean,
        streaming: Boolean(extras.streaming),
      },
    ]);
  };

  const extractAiText = (payload) => {
    if (typeof payload === "string") return payload;
    if (!payload || typeof payload !== "object") return "";
    return payload.answer || payload.text || payload.message || payload.summary || payload.diagnosis || "";
  };

  const finalizeAiText = (payload) => {
    const summary = extractAiText(payload);
    if (summary) return summary;
    if (payload == null) return "";
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const awaitingReply = Boolean(messages[messages.length - 1]?.streaming);

  useEffect(() => {
    if (!socket || !user) return;

    // Join AI room (optional but recommended)
    socket.emit("ai:join");

    const handleStatus = (msg) => {
      pushMessage("sys", msg);
    };

    const handleChunk = (chunk) => {
      const text = extractAiText(chunk);
      if (!String(text || "").trim()) return;

      setMessages((prev) => {
        const activeId = streamIdRef.current;
        if (activeId) {
          let updated = false;
          const next = prev.map((entry) => {
            if (entry.id !== activeId) return entry;
            updated = true;
            return {
              ...entry,
              text: `${entry.text || ""}${text}`,
              streaming: true,
            };
          });
          if (updated) return next;
        }

        const id = nextMessageId("ai");
        streamIdRef.current = id;
        return [...prev, { id, from: "ai", text, streaming: true }];
      });
    };

    const handleDone = (data) => {
      const finalText = finalizeAiText(data);
      setMessages((prev) => {
        const activeId = streamIdRef.current;
        if (activeId) {
          let updated = false;
          const next = prev.map((entry) => {
            if (entry.id !== activeId) return entry;
            updated = true;
            return {
              ...entry,
              text: entry.text || finalText || "Response received.",
              streaming: false,
            };
          });
          streamIdRef.current = "";
          if (updated) return next;
        }

        if (!finalText.trim()) return prev;
        return [...prev, { id: nextMessageId("ai"), from: "ai", text: finalText, streaming: false }];
      });
    };

    const handleDisconnect = () => {
      streamIdRef.current = "";
      pushMessage("sys", "Disconnected");
    };

    socket.on("ai:status", handleStatus);
    socket.on("ai:chunk", handleChunk);
    socket.on("ai:done", handleDone);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("ai:status", handleStatus);
      socket.off("ai:chunk", handleChunk);
      socket.off("ai:done", handleDone);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket, user]);

  const send = () => {
    if (!input.trim() || !socket || awaitingReply) return;
    const pendingId = nextMessageId("ai");

    socket.emit("ai:message", {
      type: "diagnose",
      symptoms: input,
    });

    streamIdRef.current = pendingId;
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId("user"), from: "user", text: input, streaming: false },
      { id: pendingId, from: "ai", text: "", streaming: true },
    ]);
    setInput("");
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
      </div>
    </div>
  );
}
