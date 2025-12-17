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
    <div>
      <div
        style={{
          maxHeight: 320,
          overflowY: "auto",
          border: "1px solid #eee",
          padding: 8,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              margin: 6,
              background:
                m.from === "ai"
                  ? "#eef"
                  : m.from === "user"
                  ? "#dfd"
                  : "#eee",
              padding: 8,
              borderRadius: 6,
            }}
          >
            <b>{m.from}:</b> {m.text}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
          placeholder="Describe symptoms..."
        />
        <button onClick={send}>Ask AI</button>
      </div>
    </div>
  );
}
