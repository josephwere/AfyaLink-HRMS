import React, { useState } from "react";
import { diagnose } from "../../services/aiClient";
import { useSystemSettings } from "../../utils/systemSettings.jsx";

export default function Chatbot() {
  const { settings } = useSystemSettings();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const aiName = settings?.ai?.name || "NeuroEdge";
  const aiUrl = settings?.ai?.url || "";

  async function submit() {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    try {
      const out = await diagnose(message.trim());
      setResponse(out?.out?.text || JSON.stringify(out?.out || out, null, 2));
    } catch (e) {
      setError(e.message || "Failed to get AI response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>{aiName} Assistant</h2>
          <p className="muted">
            Ask clinical support questions. Responses are logged through the backend.
          </p>
        </div>
        <div className="welcome-actions">
          {aiUrl && (
            <a className="btn-secondary" href={aiUrl} target="_blank" rel="noreferrer">
              Open Full AI Workspace
            </a>
          )}
        </div>
      </div>

      <section className="section">
        <div className="card">
          <label>Message</label>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe symptoms, context, or question"
          />
          <div className="welcome-actions">
            <button className="btn-primary" onClick={submit} disabled={loading}>
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      </section>

      <section className="section">
        <h3>Response</h3>
        <div className="card">
          {response ? (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{response}</pre>
          ) : (
            <p className="muted">No response yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
