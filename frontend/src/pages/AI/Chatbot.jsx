import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSystemSettings } from "../../utils/systemSettings.jsx";
import { chatAssistant, clearAssistantMemory, getAssistantContext } from "../../services/assistantApi";
import { useAuth } from "../../utils/auth";
import { DEFAULT_AI_ICON } from "../../constants/aiBranding";

export default function Chatbot() {
  const { settings } = useSystemSettings();
  const { user } = useAuth();
  const userId = user?.id || user?._id || "";
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const recognitionRef = useRef(null);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  const messageIdRef = useRef(0);

  const aiName = settings?.ai?.name || "NeuroEdge";
  const aiUrl = settings?.ai?.url || "";
  const aiIcon = settings?.ai?.icon || DEFAULT_AI_ICON;
  const [iconSrc, setIconSrc] = useState(aiIcon || DEFAULT_AI_ICON);

  useEffect(() => {
    setIconSrc(aiIcon || DEFAULT_AI_ICON);
  }, [aiIcon]);

  const supportsRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setContextLoading(true);
    getAssistantContext()
      .then((res) => {
        if (!alive) return;
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
      .finally(() => {
        if (alive) setContextLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    const maxHeight = 160;
    const nextHeight = Math.min(inputRef.current.scrollHeight, maxHeight);
    inputRef.current.style.height = `${nextHeight}px`;
    inputRef.current.style.overflowY = inputRef.current.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  const defaultHeight = 170;
  const defaultWeight = 70;
  const bmi = useMemo(() => {
    const meters = defaultHeight / 100;
    return meters ? Math.round((defaultWeight / (meters * meters)) * 10) / 10 : 0;
  }, []);
  const hydrationLiters = useMemo(() => Math.round(defaultWeight * 0.033 * 10) / 10, []);

  const nextMessageId = (role = "message") => {
    messageIdRef.current += 1;
    return `${role}-${Date.now()}-${messageIdRef.current}`;
  };

  const createMessage = (role, text, extras = {}) => ({
    id: extras.id || nextMessageId(role),
    role,
    text: String(text || "").trim(),
    createdAt: extras.createdAt || new Date().toISOString(),
    pending: Boolean(extras.pending),
  });

  const replaceMessage = (id, nextText, extras = {}) => {
    const clean = String(nextText || "").trim();
    if (!clean) return;
    setMessages((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              text: clean,
              pending: false,
              createdAt: extras.createdAt || new Date().toISOString(),
            }
          : entry
      )
    );
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
    const pendingId = nextMessageId("assistant");
    setMessages((prev) => [
      ...prev,
      createMessage("user", prompt),
      createMessage("assistant", `${aiName} is preparing a reply.`, {
        id: pendingId,
        pending: true,
      }),
    ]);
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
      replaceMessage(pendingId, answer);
    } catch (e) {
      const fallback = buildOfflineReply(prompt);
      replaceMessage(pendingId, fallback);
      setStatus(e?.message || "Assistant offline. Showing an offline fallback response.");
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
      <div className="ai-chat-topbar">
        <div className="ai-chat-head">
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              className="ai-chat-logo"
              decoding="async"
              loading="lazy"
              onError={() => {
                if (iconSrc !== DEFAULT_AI_ICON) setIconSrc(DEFAULT_AI_ICON);
                else setIconSrc("");
              }}
            />
          ) : null}
          <div>
            <h2>{aiName} Assistant</h2>
            <p className="muted">Ask anything about your health or workflow.</p>
          </div>
        </div>
        <div className="ai-chat-top-actions">
          {aiUrl ? (
            <a className="btn-secondary" href={aiUrl} target="_blank" rel="noreferrer">
              Open Workspace
            </a>
          ) : null}
          <button type="button" className="btn-secondary" onClick={clearMemory}>
            Clear Memory
          </button>
        </div>
      </div>

      <div className="ai-chat-body" ref={scrollerRef}>
        {!messages.length && (
          <div className="ai-chat-welcome">
            <h3>{aiName} Assistant</h3>
            <div className="ai-chat-metrics">
              <div className="ai-chat-metric">
                <span className="ai-chat-metric-label">BMI</span>
                <span className="ai-chat-metric-value">{bmi || "—"}</span>
              </div>
              <div className="ai-chat-metric">
                <span className="ai-chat-metric-label">Hydration</span>
                <span className="ai-chat-metric-value">{hydrationLiters}L</span>
              </div>
              <div className="ai-chat-metric">
                <span className="ai-chat-metric-label">Vitals</span>
                <span className="ai-chat-metric-value">Stable</span>
              </div>
            </div>
            <p className="muted">Ask anything about your health to start the chat.</p>
          </div>
        )}
        {messages.map((entry) => (
          <div key={entry.id} className={`ai-chat-bubble ${entry.role}${entry.pending ? " pending" : ""}`}>
            <div className="ai-chat-role">{entry.role === "user" ? "You" : aiName}</div>
            <div className="ai-chat-text">{entry.text}</div>
          </div>
        ))}
      </div>

      <div className="ai-chat-footer">
        <div className={`ai-chat-input-bar ${message.trim() ? "has-text" : ""}`}>
          <textarea
            ref={inputRef}
            rows={1}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
          />
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
          {(listening || !supportsRecognition) && (
            <span
              className={`ai-chat-hint ai-chat-hint-badge${listening ? " is-listening" : ""}`}
            >
              {listening ? "Listening..." : "Voice input not supported"}
            </span>
          )}
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
        {status && <p className="muted">{status}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
