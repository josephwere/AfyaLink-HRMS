import React, { useEffect, useState } from "react";
import { StatCard } from "../../components/Cards";
import { getDecisionCockpit } from "../../services/developerApi";

export default function DecisionCockpit() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    try {
      const out = await getDecisionCockpit();
      setData(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to load decision cockpit");
      setData(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Decision Cockpit</h2>
          <p className="muted">Operational anomalies, trust signals and next best actions.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Key Totals</h3>
        <div className="grid info-grid">
          <StatCard title="DLQ Failed" value={data?.totals?.dlqFailed ?? "—"} />
          <StatCard title="Workforce Pending" value={data?.totals?.workforcePending ?? "—"} />
          <StatCard title="ABAC Denials (24h)" value={data?.totals?.abacDenials24h ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>Anomalies</h3>
        <div className="panel-grid">
          {(data?.anomalies || []).map((a) => (
            <div className="card" key={a.id}>
              <strong>{a.title}</strong>
              <p className="muted">Severity: {a.severity} | Metric: {a.metric}</p>
              <p>{a.why}</p>
              <p><strong>Action:</strong> {a.action}</p>
            </div>
          ))}
          {!data?.anomalies?.length && <div className="card muted">No anomalies detected.</div>}
        </div>
      </section>

      <section className="section">
        <h3>Recommendations</h3>
        <div className="panel-grid">
          {(data?.recommendations || []).map((r, idx) => (
            <div className="card" key={`rec-${idx}`}>
              <strong>{r.type?.toUpperCase?.() || "RECOMMENDATION"}</strong>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

