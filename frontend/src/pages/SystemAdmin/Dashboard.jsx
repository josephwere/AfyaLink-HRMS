import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getSystemAdminMetrics, getRiskPolicy, updateRiskPolicy } from "../../services/systemAdminApi";
import { getDeveloperOverview, getTrustStatus, runWorkflowSlaScan } from "../../services/developerApi";
import { runStaffingForecast, runDigitalTwin } from "../../services/mlApi";

export default function SystemAdminDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [devOverview, setDevOverview] = useState(null);
  const [trust, setTrust] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [msg, setMsg] = useState(null);
  const [riskPolicy, setRiskPolicy] = useState(null);
  const [savingRisk, setSavingRisk] = useState(false);
  const [ai, setAi] = useState(null);
  const [aiTrend, setAiTrend] = useState({
    doctorGap: [],
    nurseGap: [],
    underCapacity: [],
    pendingShifts: [],
  });

  const appendTrend = (key, value) => {
    setAiTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  };

  const gapStatus = (v) => {
    const n = Number(v || 0);
    if (n <= 0) return "good";
    if (n <= 5) return "warn";
    return "risk";
  };

  const countStatus = (v, warn = 1, risk = 3) => {
    const n = Number(v || 0);
    if (n >= risk) return "risk";
    if (n >= warn) return "warn";
    return "good";
  };

  const loadAi = async () => {
    try {
      const [forecast, twin] = await Promise.all([
        runStaffingForecast({
          beds: 300,
          occupancyRate: 0.8,
          avgPatientsPerDoctor: 14,
          avgPatientsPerNurse: 5,
          horizonDays: 14,
        }),
        runDigitalTwin({
          departments: [
            { name: "ICU", staff: 22, demand: 28, absenteeismRate: 0.06 },
            { name: "Emergency", staff: 36, demand: 41, absenteeismRate: 0.05 },
            { name: "Surgery", staff: 18, demand: 17, absenteeismRate: 0.04 },
          ],
        }),
      ]);
      setAi({ forecast, twin });
      const underCapacity = Array.isArray(twin?.twin?.departments)
        ? twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
        : 0;
      appendTrend("doctorGap", forecast?.forecast?.doctorGap || 0);
      appendTrend("nurseGap", forecast?.forecast?.nurseGap || 0);
      appendTrend("underCapacity", underCapacity);
      appendTrend("pendingShifts", twin?.twin?.pendingRequests?.shifts || 0);
    } catch {
      setAi(null);
    }
  };

  useEffect(() => {
    Promise.all([
      getSystemAdminMetrics(),
      getDeveloperOverview(),
      getTrustStatus(),
    ])
      .then(([m, d, t]) => {
        setMetrics(m || null);
        setDevOverview(d || null);
        setTrust(t?.trust || null);
      })
      .catch(() => {
        setMetrics(null);
        setDevOverview(null);
        setTrust(null);
      });
    getRiskPolicy()
      .then((p) => setRiskPolicy(p || null))
      .catch(() => setRiskPolicy(null));
    loadAi();
    const timer = setInterval(loadAi, 45000);
    return () => clearInterval(timer);
  }, []);

  const runSla = async () => {
    setRunningSla(true);
    setMsg(null);
    try {
      const res = await runWorkflowSlaScan();
      const l1 = res?.result?.workforce?.escalationsL1 ?? 0;
      const l2 = res?.result?.workforce?.escalationsL2 ?? 0;
      setMsg(`SLA scan completed (L1: ${l1}, L2: ${l2})`);
      const [m, d, t] = await Promise.all([
        getSystemAdminMetrics(),
        getDeveloperOverview(),
        getTrustStatus(),
      ]);
      setMetrics(m || null);
      setDevOverview(d || null);
      setTrust(t?.trust || null);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to run SLA scan");
    } finally {
      setRunningSla(false);
    }
  };

  const saveRiskPolicy = async () => {
    if (!riskPolicy) return;
    setSavingRisk(true);
    setMsg(null);
    try {
      const updated = await updateRiskPolicy(riskPolicy);
      setRiskPolicy(updated || riskPolicy);
      setMsg("Adaptive risk policy updated.");
    } catch (err) {
      setMsg(err?.message || "Failed to update risk policy");
    } finally {
      setSavingRisk(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>System Admin Technical Center</h2>
          <p className="muted">Operational reliability, queue health, integration stability and deployment visibility.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={runSla} disabled={runningSla}>
            {runningSla ? "Running SLA Scan..." : "Run Workflow SLA Scan"}
          </button>
          <button className="btn-primary" onClick={() => navigate("/developer")}>Server Metrics</button>
          <button className="btn-secondary" onClick={() => navigate("/developer/queue-replay")}>Job Queue</button>
          <button className="btn-secondary" onClick={() => navigate("/admin/realtime")}>Integration Monitor</button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>System Widgets</h3>
        <div className="grid info-grid">
          <StatCard title="CPU / Memory" value={devOverview?.queues?.integration?.active ?? "—"} />
          <StatCard title="Req / Min" value={devOverview?.queues?.integration?.completed ?? "—"} />
          <StatCard title="Failed Logins" value={metrics?.approvals?.total ?? "—"} />
          <StatCard title="Job Status" value={devOverview?.queues?.integration?.waiting ?? "—"} />
          <StatCard title="Microservices" value={metrics?.hospitals ?? "—"} />
          <StatCard title="Database Health" value={devOverview?.queues?.dlq?.failed ?? "—"} />
          <StatCard title="Workforce Breached" value={devOverview?.queues?.workforce?.breached ?? "—"} />
          <StatCard title="Policy Denials (24h)" value={trust?.policyDenials24h ?? "—"} />
        </div>
      </section>

      <section className="section">
        <h3>Technical Operations</h3>
        <div className="panel-grid">
          <button className="action-link" onClick={() => navigate("/developer")}>Error Logs</button>
          <button className="action-link" onClick={() => navigate("/developer")}>API Logs</button>
          <button className="action-link" onClick={() => navigate("/developer/queue-replay")}>Queue Monitor</button>
          <button className="action-link" onClick={() => navigate("/developer/webhook-retry")}>Webhook Retry</button>
          <button className="action-link" onClick={() => navigate("/system-admin/abac")}>ABAC Policies</button>
          <button className="action-link" onClick={() => navigate("/system-admin/mapping-studio")}>Mapping Studio</button>
          <button className="action-link" onClick={() => navigate("/system-admin/nlp-analytics")}>NLP Analytics</button>
          <button className="action-link" onClick={() => navigate("/system-admin/clinical-intelligence")}>Clinical Intelligence</button>
          <button className="action-link" onClick={() => navigate("/system-admin/regulatory-reports")}>Regulatory Reports</button>
          <button className="action-link" onClick={() => navigate("/developer/ai-extraction-history")}>AI Extraction History</button>
          <button className="action-link" onClick={() => navigate("/super-admin/settings")}>Feature Flags</button>
          <button className="action-link" onClick={() => navigate("/admin/realtime")}>Integration Hub</button>
        </div>
      </section>

      <section className="section">
        <h3>AI Intelligence Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Doctor Gap" value={ai?.forecast?.forecast?.doctorGap ?? "—"} trend={aiTrend.doctorGap} subtitle="Auto-refresh 45s" status={gapStatus(ai?.forecast?.forecast?.doctorGap)} />
          <StatCard title="Nurse Gap" value={ai?.forecast?.forecast?.nurseGap ?? "—"} trend={aiTrend.nurseGap} subtitle="Auto-refresh 45s" status={gapStatus(ai?.forecast?.forecast?.nurseGap)} />
          <StatCard
            title="Under-Capacity Units"
            value={
              Array.isArray(ai?.twin?.twin?.departments)
                ? ai.twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
                : "—"
            }
            trend={aiTrend.underCapacity}
            subtitle="Auto-refresh 45s"
            status={countStatus(
              Array.isArray(ai?.twin?.twin?.departments)
                ? ai.twin.twin.departments.filter((d) => d.status === "UNDER_CAPACITY").length
                : 0,
              1,
              2
            )}
          />
          <StatCard title="Twin Pending Shifts" value={ai?.twin?.twin?.pendingRequests?.shifts ?? "—"} trend={aiTrend.pendingShifts} subtitle="Auto-refresh 45s" status={countStatus(ai?.twin?.twin?.pendingRequests?.shifts, 5, 15)} />
        </div>
      </section>

      <section className="section">
        <h3>Adaptive Risk Policy</h3>
        <div className="card">
          {!riskPolicy ? (
            <p className="muted">Risk policy unavailable.</p>
          ) : (
            <>
              <div className="grid info-grid">
                <label className="muted">
                  High Threshold
                  <input
                    type="number"
                    value={riskPolicy.thresholds?.high ?? 70}
                    onChange={(e) =>
                      setRiskPolicy((p) => ({
                        ...p,
                        thresholds: { ...(p?.thresholds || {}), high: Number(e.target.value || 70) },
                      }))
                    }
                  />
                </label>
                <label className="muted">
                  Critical Threshold
                  <input
                    type="number"
                    value={riskPolicy.thresholds?.critical ?? 90}
                    onChange={(e) =>
                      setRiskPolicy((p) => ({
                        ...p,
                        thresholds: { ...(p?.thresholds || {}), critical: Number(e.target.value || 90) },
                      }))
                    }
                  />
                </label>
                <label className="muted">
                  Restriction Minutes
                  <input
                    type="number"
                    value={riskPolicy.restrictionMinutes ?? 30}
                    onChange={(e) =>
                      setRiskPolicy((p) => ({ ...p, restrictionMinutes: Number(e.target.value || 30) }))
                    }
                  />
                </label>
                <label className="muted">
                  Impossible Travel Window (min)
                  <input
                    type="number"
                    value={riskPolicy.impossibleTravelWindowMinutes ?? 90}
                    onChange={(e) =>
                      setRiskPolicy((p) => ({
                        ...p,
                        impossibleTravelWindowMinutes: Number(e.target.value || 90),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="welcome-actions" style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={saveRiskPolicy} disabled={savingRisk}>
                  {savingRisk ? "Saving..." : "Save Risk Policy"}
                </button>
                <button className="btn-secondary" onClick={() => navigate("/step-up")}>
                  Step-up Console
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Admin Controls</h3>
        <div className="action-list">
          <button className="action-link" onClick={() => navigate("/super-admin/hospitals")}>Hospitals</button>
          <button className="action-link" onClick={() => navigate("/admin/create-admin")}>Role Overrides</button>
          <button className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
          <button className="action-link" onClick={() => navigate("/admin/notifications")}>Alerts</button>
        </div>
      </section>
    </div>
  );
}
