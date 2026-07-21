import React from "react";
import { useVoiceDictation } from "../../hooks/useVoiceDictation";

export default function VoiceDictation() {
  const { audioBase64, setAudioBase64, text, loading, error, run } = useVoiceDictation();

  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Dictation lab</div>
        <div>
          <h1 className="premium-shell-title">Voice Dictation</h1>
          <p className="premium-shell-subtitle">
            Send recorded audio payloads through the configured AI transcription provider and inspect the transcript without leaving the product.
          </p>
        </div>
      </section>

      <div className="premium-split">
        <section className="card premium-card form premium-stack">
          <label>Audio (base64)</label>
          <textarea
            rows={8}
            value={audioBase64}
            onChange={(e) => setAudioBase64(e.target.value)}
            placeholder="Base64 audio payload"
          />
          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={run} disabled={loading}>
              {loading ? "Transcribing..." : "Transcribe"}
            </button>
          </div>
          {error && <div className="premium-inline-note">{error}</div>}
        </section>

        <aside className="card premium-card premium-stack">
          <div className="premium-tag">Transcript</div>
          {text ? (
            <div className="premium-console">
              <pre>{text}</pre>
            </div>
          ) : (
            <div className="premium-empty">
              <strong>No transcript yet</strong>
              <span>Paste an audio payload and run transcription to populate this output panel.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
