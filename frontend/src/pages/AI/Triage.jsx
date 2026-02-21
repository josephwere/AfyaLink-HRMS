import React, { useState } from "react";
import { triage } from "../../services/aiClient";

export default function Triage() {
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!symptoms.trim()) return;
    setLoading(true);
    setError("");
    try {
      const out = await triage(symptoms.trim());
      setResult(out);
    } catch (e) {
      setError(e.message || "Failed to classify triage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>AI Triage</h2>
          <p className="muted">
            Submit symptom details to get a triage priority and guidance.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="card">
          <label>Symptoms / Case Summary</label>
          <textarea
            rows={6}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. chest pain for 2 hours, shortness of breath..."
          />
          <div className="welcome-actions">
            <button className="btn-primary" onClick={run} disabled={loading}>
              {loading ? "Analyzing..." : "Run Triage"}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      </section>

      <section className="section">
        <h3>Triage Output</h3>
        <div className="card">
          {!result && <p className="muted">No triage result yet.</p>}
          {result && (
            <>
              <p>
                Priority: <strong>{result.priority || "unknown"}</strong>
              </p>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(result.out || result, null, 2)}
              </pre>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
