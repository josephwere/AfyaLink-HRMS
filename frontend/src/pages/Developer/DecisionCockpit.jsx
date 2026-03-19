import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getDecisionCockpit } from "../../services/developerApi";

export default function DecisionCockpit() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const anomaliesSectionRef = useRef(null);
  const recommendationsSectionRef = useRef(null);

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          <button type="button" className="btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Key Totals</h3>
        <div className="grid info-grid">
          <StatCard title="DLQ Failed" value={data?.totals?.dlqFailed ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Workforce Pending" value={data?.totals?.workforcePending ?? "—"} onClick={() => scrollToSection(recommendationsSectionRef)} />
          <StatCard title="ABAC Denials (24h)" value={data?.totals?.abacDenials24h ?? "—"} onClick={() => scrollToSection(anomaliesSectionRef)} />
        </div>
      </section>

      <section className="section" ref={anomaliesSectionRef}>
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

      <section className="section" ref={recommendationsSectionRef}>
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
