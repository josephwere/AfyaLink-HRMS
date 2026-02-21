import React, { useState } from "react";
import { transcribeAudioBase64 } from "../../services/aiClient";

export default function VoiceDictation() {
  const [audioBase64, setAudioBase64] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!audioBase64.trim()) return;
    setLoading(true);
    setError("");
    try {
      const out = await transcribeAudioBase64(audioBase64.trim());
      setText(out?.text || JSON.stringify(out, null, 2));
    } catch (e) {
      setError(e.message || "Failed to transcribe audio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Voice Dictation</h2>
          <p className="muted">
            Paste base64 audio payload to transcribe through your AI provider.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="card">
          <label>Audio (base64)</label>
          <textarea
            rows={6}
            value={audioBase64}
            onChange={(e) => setAudioBase64(e.target.value)}
            placeholder="Base64 audio payload"
          />
          <div className="welcome-actions">
            <button className="btn-primary" onClick={run} disabled={loading}>
              {loading ? "Transcribing..." : "Transcribe"}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      </section>

      <section className="section">
        <h3>Transcript</h3>
        <div className="card">
          {text ? <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{text}</pre> : <p className="muted">No transcript yet.</p>}
        </div>
      </section>
    </div>
  );
}
