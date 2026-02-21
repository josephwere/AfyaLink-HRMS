import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getHRDashboard } from "../../services/dashboardApi";
import { runBurnoutScore, runCausalImpact } from "../../services/mlApi";

export default function HRManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [burnout, setBurnout] = useState(null);
  const [causal, setCausal] = useState(null);
  const [trend, setTrend] = useState({
    burnoutScore: [],
    projectedKpi: [],
    projectedChange: [],
  });

  const push = (key, value) => {
    setTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  };

  const burnoutStatus = (score) => {
    const n = Number(score || 0);
    if (n >= 75) return "risk";
    if (n >= 45) return "warn";
    return "good";
  };

  const changeStatus = (pct) => {
    const n = Number(pct || 0);
    if (n < 0) return "risk";
    if (n < 3) return "warn";
    return "good";
  };

  const loadAi = async () => {
    try {
      const [b, c] = await Promise.all([
        runBurnoutScore({
          hoursPerWeek: 50,
          nightShifts: 4,
          consecutiveDays: 6,
          overtimeHours: 10,
          leaveBalanceDays: 9,
          incidentsIn30d: 1,
        }),
        runCausalImpact({
          baseline: 100,
          interventions: [
            { name: "Shift rebalance", effectPct: 6, confidence: 0.75 },
            { name: "Fast-track hiring", effectPct: 8, confidence: 0.65 },
          ],
        }),
      ]);
      setBurnout(b || null);
      setCausal(c || null);
      push("burnoutScore", b?.score || 0);
      push("projectedKpi", c?.projected || 0);
      push("projectedChange", c?.changePct || 0);
    } catch {
      setBurnout(null);
      setCausal(null);
    }
  };

  useEffect(() => {
    getHRDashboard().then(setData).catch(() => setData(null));
    loadAi();
    const timer = setInterval(loadAi, 45000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>HR Manager Command Center</h2>
          <p className="muted">Recruitment, onboarding, contracts, performance and workforce analytics.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Pipeline</button>
          <button className="btn-secondary" onClick={() => navigate("/hospital-admin/staff")}>Employee Profiles</button>
          <button className="btn-secondary" onClick={() => navigate("/workforce/requests")}>Leave Management</button>
        </div>
      </div>

      <section className="section">
        <h3>Top HR KPIs</h3>
        <div className="grid info-grid">
          <StatCard title="Open Positions" value={data?.newHires ?? "—"} />
          <StatCard title="Leave Pending" value={data?.pendingRequests?.leave ?? "—"} />
          <StatCard title="Turnover %" value={data?.inactiveStaff ?? "—"} />
          <StatCard title="Compliance Alerts" value={data?.missingLicenses ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Center Workspace</h3>
          <div className="panel-grid">
            <button className="action-link" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Kanban</button>
            <button className="action-link" onClick={() => navigate("/hospital-admin/staff")}>Contracts</button>
            <button className="action-link" onClick={() => navigate("/hr-manager")}>Performance Reviews</button>
            <button className="action-link" onClick={() => navigate("/hr-manager")}>Training & Certifications</button>
            <button className="action-link" onClick={() => navigate("/hr-manager")}>Succession Planning</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Right Insights</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Requests: {data?.pendingRequests?.total ?? "—"}</div>
            <div className="action-pill">Incomplete Staff: {data?.incompleteStaff ?? "—"}</div>
            <div className="action-pill">Inactive Staff: {data?.inactiveStaff ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>AI Workforce Intelligence</h3>
        <div className="grid info-grid">
          <StatCard title="Burnout Score" value={burnout?.score ?? "—"} trend={trend.burnoutScore} subtitle="Auto-refresh 45s" status={burnoutStatus(burnout?.score)} />
          <StatCard title="Burnout Band" value={burnout?.band ?? "—"} />
          <StatCard title="Projected KPI" value={causal?.projected ?? "—"} trend={trend.projectedKpi} subtitle="Auto-refresh 45s" status={changeStatus(causal?.changePct)} />
          <StatCard title="Projected Change %" value={causal?.changePct ?? "—"} trend={trend.projectedChange} subtitle="Auto-refresh 45s" status={changeStatus(causal?.changePct)} />
        </div>
      </section>
    </div>
  );
}
