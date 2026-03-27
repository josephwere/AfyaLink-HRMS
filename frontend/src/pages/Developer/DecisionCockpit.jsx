import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getDecisionCockpit } from "../../services/developerApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

const severityTone = (severity) => {
  const value = String(severity || "").toUpperCase();
  if (["CRITICAL", "HIGH"].includes(value)) return "risk";
  if (["MEDIUM", "WARN"].includes(value)) return "warn";
  return "good";
};

export default function DecisionCockpit() {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
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

  const anomalyCount = data?.anomalies?.length || 0;
  const recommendationCount = data?.recommendations?.length || 0;
  const riskAnomalyCount = (data?.anomalies || []).filter((item) => severityTone(item.severity) === "risk").length;

  const trustCards = useMemo(
    () => [
      { title: "Ledger Writes (24h)", value: data?.trust?.ledgerWrites24h ?? "—", subtitle: "Compliance proofs written" },
      { title: "Policy Denials (24h)", value: data?.trust?.policyDenials24h ?? "—", subtitle: "Rules blocked by policy", status: Number(data?.trust?.policyDenials24h || 0) > 0 ? "warn" : "good" },
      { title: "Consent Denials (24h)", value: data?.trust?.consentDenials24h ?? "—", subtitle: "Exports rejected for consent", status: Number(data?.trust?.consentDenials24h || 0) > 0 ? "risk" : "good" },
      { title: "Risk Step-Ups (24h)", value: data?.trust?.highRiskStepUps24h ?? "—", subtitle: "Access friction spikes", status: Number(data?.trust?.highRiskStepUps24h || 0) > 0 ? "warn" : "good" },
    ],
    [data]
  );

  return (
    <div className="dashboard developer-console-page">
      <section className="welcome-panel premium-card developer-console-hero decision-console-hero">
        <div className="developer-console-hero-copy">
          <div className="developer-console-kicker">Decision intelligence</div>
          <h2>Decision Cockpit</h2>
          <p className="muted">Operational anomalies, trust signals, and next-best routing actions arranged like a real response console.</p>
          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={load}>Refresh Cockpit</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/queue-replay")}>Open Queue Replay</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/provenance-verify")}>Provenance Verify</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/webhook-retry")}>Webhook Recovery</button>
          </div>
        </div>
        <div className="developer-console-hero-meta">
          <div className={`developer-console-pulse ${riskAnomalyCount > 0 ? "risk" : anomalyCount > 0 ? "warn" : "good"}`}>
            <span>{translateText("Anomaly pressure")}</span>
            <strong>{riskAnomalyCount > 0 ? translateText("ALERT") : anomalyCount > 0 ? translateText("WATCH") : translateText("OK")}</strong>
            <small>{anomalyCount} anomalies detected, {riskAnomalyCount} severe enough to need operator action</small>
          </div>
          <div className={`developer-console-pulse ${Number(data?.totals?.workforcePending || 0) > 50 ? "risk" : Number(data?.totals?.workforcePending || 0) > 10 ? "warn" : "good"}`}>
            <span>{translateText("Workforce load")}</span>
            <strong>{data?.totals?.workforcePending ?? "—"}</strong>
            <small>Pending requests waiting for routing, approval, or escalation.</small>
          </div>
          <div className={`developer-console-pulse ${Number(data?.totals?.abacDenials24h || 0) > 20 ? "risk" : Number(data?.totals?.abacDenials24h || 0) > 5 ? "warn" : "good"}`}>
            <span>{translateText("Policy pressure")}</span>
            <strong>{data?.totals?.abacDenials24h ?? "—"}</strong>
            <small>ABAC denials in the last 24 hours.</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>{translateText("Recommendations")}</span>
            <strong>{recommendationCount}</strong>
            <small>Actionable suggestions ready for review or replay.</small>
          </div>
        </div>
      </section>

      {msg ? <div className="premium-inline-note">{msg}</div> : null}

      <section className="section">
        <div className="card-header-actions">
          <div>
            <h3>Key Totals</h3>
            <p className="muted">Fast totals that jump you into the exact section or tool that needs attention.</p>
          </div>
        </div>
        <div className="grid info-grid">
          <StatCard title="DLQ Failed" value={data?.totals?.dlqFailed ?? "—"} subtitle="Replay-ready failures" status={Number(data?.totals?.dlqFailed || 0) > 0 ? "risk" : "good"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Workforce Pending" value={data?.totals?.workforcePending ?? "—"} subtitle="Waiting for workflow routing" status={Number(data?.totals?.workforcePending || 0) > 20 ? "warn" : "good"} onClick={() => scrollToSection(recommendationsSectionRef)} />
          <StatCard title="ABAC Denials (24h)" value={data?.totals?.abacDenials24h ?? "—"} subtitle="Policy friction signals" status={Number(data?.totals?.abacDenials24h || 0) > 0 ? "warn" : "good"} onClick={() => scrollToSection(anomaliesSectionRef)} />
          {trustCards.map((card) => (
            <StatCard key={card.title} title={card.title} value={card.value} subtitle={card.subtitle} status={card.status} onClick={() => scrollToSection(anomaliesSectionRef)} />
          ))}
        </div>
      </section>

      <section className="section developer-console-grid">
        <div className="card premium-card developer-console-table-card" ref={anomaliesSectionRef}>
          <div className="card-header-actions">
            <div>
              <h3>Anomaly Stack</h3>
              <p className="muted">Structured anomaly cards that keep severity, metric, root cause, and recommended action in one place.</p>
            </div>
            <div className="developer-chip-row">
              <span className="developer-chip">Total: {anomalyCount}</span>
              <span className="developer-chip soft">High: {riskAnomalyCount}</span>
            </div>
          </div>
          <div className="developer-anomaly-grid">
            {(data?.anomalies || []).map((item) => (
              <div key={item.id} className={`developer-anomaly-card ${severityTone(item.severity)}`}>
                <div className="card-header-actions">
                  <div>
                    <span className={`developer-state-badge ${severityTone(item.severity)}`}>{translateText(item.severity || "MEDIUM")}</span>
                    <h4>{item.title}</h4>
                  </div>
                  <div className="developer-metric-chip">{item.metric}</div>
                </div>
                <p className="muted">Metric: {item.metric}</p>
                <p>{item.why}</p>
                <div className="developer-runbook-item compact">
                  <strong>Recommended action</strong>
                  <p className="muted">{item.action}</p>
                </div>
                <div className="developer-inline-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(item.id === "dlq_failed" ? "/developer/queue-replay" : item.id === "abac_denials" ? "/developer/provenance-verify" : "/developer/decision-cockpit")}
                  >
                    Open Resolution Path
                  </button>
                </div>
              </div>
            ))}
            {!data?.anomalies?.length && (
              <div className="developer-empty-state large">
                <strong>No anomalies detected.</strong>
                <p className="muted">The cockpit is quiet right now. Refresh when you want a new decision pass.</p>
              </div>
            )}
          </div>
        </div>

        <div className="developer-console-stack" ref={recommendationsSectionRef}>
          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Next Best Actions</h3>
                <p className="muted">Short, operator-friendly recommendations grouped like a response playbook.</p>
              </div>
            </div>
            <div className="developer-recommendation-list">
              {(data?.recommendations || []).map((item, index) => (
                <div key={`rec-${index}`} className="developer-recommendation-card">
                  <span className="developer-tool-eyebrow">{item.type?.toUpperCase?.() || "RECOMMENDATION"}</span>
                  <p>{item.text}</p>
                </div>
              ))}
              {!data?.recommendations?.length && (
                <div className="developer-empty-state compact">
                  <strong>No recommendations yet.</strong>
                  <p className="muted">Recommendations appear when the cockpit has enough signal to suggest a next move.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Trust Snapshot</h3>
                <p className="muted">A fast read of the controls supporting routing safety and auditability.</p>
              </div>
            </div>
            <div className="developer-activity-list">
              {trustCards.map((card) => (
                <div key={card.title} className="developer-activity-item">
                  <div>
                    <strong>{card.title}</strong>
                    <p className="muted">{card.subtitle}</p>
                  </div>
                  <span className={`developer-state-badge ${card.status || "neutral"}`}>{card.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
