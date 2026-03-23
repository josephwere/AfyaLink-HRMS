import React, { useEffect, useState } from "react";
import { useSocket } from "../utils/socket";
import { useAuth } from "../utils/auth";

export default function AIChatWS() {
  const socket = useSocket();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!socket || !user) return;

    // Join AI room (optional but recommended)
    socket.emit("ai:join");

    socket.on("ai:status", (msg) => {
      setMessages((m) => [...m, { from: "sys", text: msg }]);
    });

    socket.on("ai:chunk", (chunk) => {
      setMessages((m) => [...m, { from: "ai", text: chunk }]);
    });

    socket.on("ai:done", (data) => {
      setMessages((m) => [
        ...m,
        { from: "ai", text: JSON.stringify(data) },
      ]);
    });

    socket.on("disconnect", () => {
      setMessages((m) => [...m, { from: "sys", text: "Disconnected" }]);
    });

    return () => {
      socket.off("ai:status");
      socket.off("ai:chunk");
      socket.off("ai:done");
    };
  }, [socket, user]);

  const send = () => {
    if (!input.trim() || !socket) return;

    socket.emit("ai:message", {
      type: "diagnose",
      symptoms: input,
    });

    setMessages((m) => [...m, { from: "user", text: input }]);
    setInput("");
  };

  return (
    <div className="mini-chat-shell">
      <div className="mini-chat-log">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`mini-chat-bubble${
              m.from === "user" ? " is-user" : m.from === "ai" ? " is-assistant" : ""
            }`}
          >
            <strong>{m.from === "user" ? "You" : m.from === "ai" ? "NeuroEdge" : "System"}</strong>
            <span>{m.text}</span>
          </div>
        ))}
      </div>

      <div className="mini-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe symptoms..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="actions-row">
          <button type="button" className="btn-primary" onClick={send}>Ask AI</button>
        </div>
      </div>
    </div>
  );
}
