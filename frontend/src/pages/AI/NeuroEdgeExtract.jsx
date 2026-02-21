import React, { useState } from "react";
import { extractDocument } from "../../services/aiExtractionApi";

export default function NeuroEdgeExtract() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const out = await extractDocument(file);
      setResult(out || null);
    } catch (e) {
      setError(e?.message || "Failed to extract document");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>NeuroEdge Extract</h2>
          <p className="muted">Upload PDF/text/image files to extract raw content and structured fields.</p>
        </div>
      </div>

      <section className="section">
        <div className="card">
          <label>Upload file</label>
          <input
            type="file"
            accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="welcome-actions">
            <button className="btn-primary" onClick={run} disabled={!file || loading}>
              {loading ? "Extracting..." : "Extract"}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      </section>

      <section className="section">
        <h3>Extraction Output</h3>
        <div className="card">
          {result ? (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="muted">No extraction result yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

