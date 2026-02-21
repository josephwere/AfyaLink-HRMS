import React, { useState } from "react";
import { queryNlpAnalytics } from "../../services/intelligenceApi";

export default function NlpAnalytics() {
  const [query, setQuery] = useState("Show pending approvals this week");
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setMsg("");
    setResult(null);
    try {
      const out = await queryNlpAnalytics(query);
      setResult(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to run NLP analytics query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>NLP Analytics</h2>
          <p className="muted">Ask analytics questions in natural language and get actionable metrics.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading ? "Running..." : "Run Query"}
          </button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="card">
          <label>
            Query
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. show revenue for last 30 days"
            />
          </label>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-secondary" onClick={() => setQuery("Show revenue this month")}>
              Revenue
            </button>
            <button className="btn-secondary" onClick={() => setQuery("Show active staff")}>
              Staff
            </button>
            <button className="btn-secondary" onClick={() => setQuery("Show pending approvals")}>
              Approvals
            </button>
          </div>
        </div>
      </section>

      {result && (
        <section className="section">
          <div className="card">
            <h3>Interpretation</h3>
            <p>{result.interpretation}</p>
            <h3>Metrics</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result.metrics, null, 2)}</pre>
            <h3>Suggested Follow-ups</h3>
            <ul>
              {(result.suggestedFollowUps || []).map((s, i) => (
                <li key={`s-${i}`}>{s}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

