import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getHRDashboard } from "../../services/dashboardApi";
import { runBurnoutScore, runCausalImpact } from "../../services/mlApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";

export default function HRManagerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [burnout, setBurnout] = useState(null);
  const [causal, setCausal] = useState(null);
  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [trend, setTrend] = useState({
    burnoutScore: [],
    projectedKpi: [],
    projectedChange: [],
    trainingCompletion: [],
  });
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

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
  const badgeFromStatus = (s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK");

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
    listTrainingTrackers({ limit: 200 })
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        const now = Date.now();
        const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
        const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
        const completed = rows.filter((r) => r.status === "COMPLETED").length;
        const overdueNotStarted = rows.filter(
          (r) =>
            r.status === "NOT_STARTED" &&
            r.createdAt &&
            now - new Date(r.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
        ).length;
        const overdueInProgress = rows.filter(
          (r) =>
            r.status === "IN_PROGRESS" &&
            r.updatedAt &&
            now - new Date(r.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
        ).length;
        const total = rows.length;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        setTraining({
          total,
          notStarted,
          inProgress,
          completed,
          overdueNotStarted,
          overdueInProgress,
          completionRate,
        });
        push("trainingCompletion", completionRate);
      })
      .catch(() =>
        setTraining({
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          overdueNotStarted: 0,
          overdueInProgress: 0,
          completionRate: 0,
        })
      );
    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
    const timer = setInterval(loadAi, 45000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>HR Manager Dashboard</h2>
          <p className="muted">Simple HR view for hiring, staff records, and performance.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Pipeline</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/staff")}>Employee Profiles</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/workforce/requests")}>Leave Management</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}>Training Tracker</button>
        </div>
      </div>

      <section className="section">
        <h3>Top HR KPIs</h3>
        <div className="grid info-grid">
          <StatCard title="Open Positions" value={data?.newHires ?? "—"} />
          <StatCard title="Leave Pending" value={data?.pendingRequests?.leave ?? "—"} />
          <StatCard title="Turnover %" value={data?.inactiveStaff ?? "—"} />
          <StatCard title="Compliance Alerts" value={data?.missingLicenses ?? "—"} />
          <StatCard
            title="Training Completion %"
            value={training.completionRate}
            trend={trend.trainingCompletion}
            subtitle={`${training.completed}/${training.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </section>

      <section className="section">
        <h3>Training Tracker</h3>
        <div className="grid info-grid">
          <StatCard
            title="Total Trainees"
            value={training.total}
            onClick={() => navigate("/admin/training-tracker")}
          />
          <StatCard
            title="Not Started"
            value={training.notStarted}
            onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")}
          />
          <StatCard
            title="In Progress"
            value={training.inProgress}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
          <StatCard
            title="Completed"
            value={training.completed}
            onClick={() => navigate("/admin/training-tracker?status=COMPLETED")}
          />
          <StatCard
            title="Overdue Not Started"
            value={training.overdueNotStarted}
            onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")}
          />
          <StatCard
            title="Overdue In Progress"
            value={training.overdueInProgress}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Main Tasks</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Kanban</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff")}>Contracts</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Performance Reviews</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff?q=license")}>Training & Certifications</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")}>Training Tracker Board</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/register-staff?view=planning")}>Succession Planning</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Requests: {data?.pendingRequests?.total ?? "—"}</div>
            <div className="action-pill">Incomplete Staff: {data?.incompleteStaff ?? "—"}</div>
            <div className="action-pill">Inactive Staff: {data?.inactiveStaff ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/register-staff")}>
              Staffing Support
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Assign a receiving clinician early for pending transfers.</div>
            <div className="alert-item">Escalate staffing gaps in transfer-heavy wards.</div>
            <div className="alert-item">Coordinate leave coverage for high transfer load.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>AI Workforce Intelligence</h3>
        <div className="grid info-grid">
          <StatCard
            title="Burnout Score"
            value={burnout?.score ?? "—"}
            trend={trend.burnoutScore}
            subtitle="Auto-refresh 45s"
            status={burnoutStatus(burnout?.score)}
            badge={badgeFromStatus(burnoutStatus(burnout?.score))}
            why={`Burnout score ${burnout?.score ?? 0}; >=75 high risk, 45-74 medium.`}
            onBadgeClick={() => navigate("/workforce/requests?status=PENDING")}
          />
          <StatCard title="Burnout Band" value={burnout?.band ?? "—"} />
          <StatCard
            title="Projected KPI"
            value={causal?.projected ?? "—"}
            trend={trend.projectedKpi}
            subtitle="Auto-refresh 45s"
            status={changeStatus(causal?.changePct)}
            badge={badgeFromStatus(changeStatus(causal?.changePct))}
            why={`Projected KPI is ${causal?.projected ?? 0}; negative expected change means risk.`}
            onBadgeClick={() => navigate("/hospital-admin/register-staff")}
          />
          <StatCard
            title="Projected Change %"
            value={causal?.changePct ?? "—"}
            trend={trend.projectedChange}
            subtitle="Auto-refresh 45s"
            status={changeStatus(causal?.changePct)}
            badge={badgeFromStatus(changeStatus(causal?.changePct))}
            why={`Change ${causal?.changePct ?? 0}%; <0 is risk, 0-3 is watch.`}
            onBadgeClick={() => navigate("/hospital-admin/register-staff")}
          />
        </div>
      </section>
    </div>
  );
}
