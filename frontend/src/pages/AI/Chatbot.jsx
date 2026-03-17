import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSystemSettings } from "../../utils/systemSettings.jsx";
import { chatAssistant, clearAssistantMemory, getAssistantContext } from "../../services/assistantApi";
import { useAuth } from "../../utils/auth";

export default function Chatbot() {
  const { settings } = useSystemSettings();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const recognitionRef = useRef(null);
  const scrollerRef = useRef(null);

  const aiName = settings?.ai?.name || "NeuroEdge";
  const aiUrl = settings?.ai?.url || "";
  const aiIcon = settings?.ai?.icon || settings?.branding?.appIcon || "";

  const supportsRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!user) return;
    setContextLoading(true);
    getAssistantContext()
      .then((res) => {
        const memory = Array.isArray(res?.context?.chatHistory) ? res.context.chatHistory : [];
        setMessages(
          memory
            .filter((entry) => entry?.text)
            .map((entry) => ({
              id: entry.id || `${entry.role || "assistant"}-${entry.createdAt || Date.now()}`,
              role: entry.role === "user" ? "user" : "assistant",
              text: entry.text,
              createdAt: entry.createdAt || new Date().toISOString(),
            }))
        );
      })
      .catch(() => {})
      .finally(() => setContextLoading(false));
  }, [user]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  const appendMessage = (role, text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    setMessages((prev) => [
      ...prev,
      { id: `${role}-${Date.now()}`, role, text: clean, createdAt: new Date().toISOString() },
    ]);
  };

  const buildOfflineReply = (prompt) => {
    return [
      "Assistant service is temporarily unavailable.",
      "Your message was captured and will be answered when the service is back.",
      `You asked: "${prompt}"`,
      "If you have urgent symptoms, contact a clinician immediately.",
    ].join("\n");
  };

  const submit = async () => {
    const prompt = String(message || "").trim();
    if (!prompt) return;
    appendMessage("user", prompt);
    setMessage("");
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const out = await chatAssistant({
        message: prompt,
        userMessage: prompt,
        pageContext: "",
      });
      const answer = out?.answer || out?.text || "No response generated.";
      appendMessage("assistant", answer);
    } catch (e) {
      const fallback = buildOfflineReply(prompt);
      appendMessage("assistant", fallback);
      setStatus(e?.message || "Assistant offline. Showing fallback response.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const startDictation = () => {
    if (!supportsRecognition || typeof window === "undefined") {
      setStatus("Voice input is not supported in this browser.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Voice input is not supported in this browser.");
      return;
    }
    if (recognitionRef.current) {
      stopDictation();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setMessage((prev) => `${prev}${prev ? " " : ""}${transcript}`.trim());
      }
    };
    recognition.onerror = () => {
      setStatus("Voice input failed. Try again.");
      stopDictation();
    };
    recognition.onend = () => {
      stopDictation();
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const clearMemory = async () => {
    try {
      await clearAssistantMemory();
      setMessages([]);
      setStatus("Assistant memory cleared.");
    } catch (err) {
      setStatus(err?.message || "Failed to clear memory.");
    }
  };

  return (
    <div className="dashboard ai-chat-page">
      <div className="welcome-panel">
        <div className="ai-chat-head">
          {aiIcon ? <img src={aiIcon} alt="" className="ai-chat-logo" /> : null}
          <div>
            <h2>{aiName} Chat</h2>
            <p className="muted">
              Ask anything about your health or workflow and get real-time answers.
            </p>
          </div>
        </div>
        <div className="welcome-actions">
          {aiUrl && (
            <a className="btn-secondary" href={aiUrl} target="_blank" rel="noreferrer">
              Open Full AI Workspace
            </a>
          )}
          <button type="button" className="btn-secondary" onClick={clearMemory}>
            Clear Memory
          </button>
        </div>
      </div>

      <section className="section">
        <div className="card ai-chat-shell">
          <div className="ai-chat-window" ref={scrollerRef}>
            {contextLoading && <p className="muted">Loading chat history...</p>}
            {!contextLoading && !messages.length && (
              <div className="ai-chat-empty">
                Start a conversation. Your assistant will respond here.
              </div>
            )}
            {messages.map((entry) => (
              <div key={entry.id} className={`ai-chat-bubble ${entry.role}`}>
                <div className="ai-chat-role">{entry.role === "user" ? "You" : aiName}</div>
                <div className="ai-chat-text">{entry.text}</div>
              </div>
            ))}
          </div>
          <div className="ai-chat-input-wrap">
            <label className="sr-only">Message</label>
            <div className="ai-chat-input-bar">
              <button
                type="button"
                className="ai-chat-icon"
                onClick={startDictation}
                disabled={!supportsRecognition}
                aria-label={listening ? "Stop recording" : "Speak"}
                title={listening ? "Stop recording" : "Speak"}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20h2v-2.08A7 7 0 0 0 19 11h-2z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <textarea
                rows={1}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question here..."
              />
              <button
                type="button"
                className="ai-chat-send"
                onClick={submit}
                disabled={loading || !message.trim()}
                aria-label="Send"
                title="Send"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 5l7 7-1.4 1.4L13 8.8V19h-2V8.8L6.4 13.4 5 12l7-7z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <div className="ai-chat-hint">
              {listening ? "Listening..." : supportsRecognition ? "Tap the mic to speak" : "Voice input not supported"}
            </div>
            {status && <p className="muted">{status}</p>}
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
