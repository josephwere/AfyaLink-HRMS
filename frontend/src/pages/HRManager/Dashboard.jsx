import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { StatCard } from "../../components/Cards";
import { getHRDashboard } from "../../services/dashboardApi";
import { runBurnoutScore, runCausalImpact } from "../../services/mlApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function HRManagerDashboard() {
  const { translateText } = useAppLanguage();
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
    <DashboardHomeShell
      shellKey="people_hr_manager"
      kicker={translateText("People")}
      title={translateText("HR Manager")}
      subtitle={translateText("Hiring, staff readiness, training completeness, and workforce intelligence.")}
      actions={[
        { label: translateText("Recruitment Pipeline"), path: "/app/people/staff/register" },
        { label: translateText("Employee Profiles"), path: "/app/people/staff/index", variant: "secondary" },
        { label: translateText("Leave Management"), path: "/app/people/requests/index", variant: "secondary" },
        { label: translateText("Training Tracker"), path: "/app/people/training/tracker?status=IN_PROGRESS", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Requests"), value: data?.pendingRequests?.total ?? "—", path: "/app/people/requests/index" },
        { label: translateText("Incomplete Staff"), value: data?.incompleteStaff ?? "—", path: "/app/people/staff/index" },
        { label: translateText("Training Completion %"), value: training.completionRate, path: "/app/people/training/tracker" },
        { label: translateText("Burnout Score"), value: burnout?.score ?? "—", path: "/app/people/requests/index?status=PENDING" },
      ]}
    >
      <DashboardSection title={translateText("Training Tracker")} subtitle={translateText("Keep onboarding and compliance training moving without chasing spreadsheets.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Total Trainees")} value={training.total} path="/app/people/training/tracker" />
          <StatCard title={translateText("Not Started")} value={training.notStarted} path="/app/people/training/tracker?status=NOT_STARTED" />
          <StatCard title={translateText("In Progress")} value={training.inProgress} path="/app/people/training/tracker?status=IN_PROGRESS" />
          <StatCard title={translateText("Completed")} value={training.completed} path="/app/people/training/tracker?status=COMPLETED" />
          <StatCard title={translateText("Overdue Not Started")} value={training.overdueNotStarted} path="/app/people/training/tracker?status=NOT_STARTED" />
          <StatCard title={translateText("Overdue In Progress")} value={training.overdueInProgress} path="/app/people/training/tracker?status=IN_PROGRESS" />
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Operational handoffs that affect staffing coverage and leave planning.")}>
        {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="doctor-table">
            <thead>
              <tr>
                <th>{translateText("Patient")}</th>
                <th>{translateText("Route")}</th>
                <th>{translateText("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t._id}>
                  <td>
                    {t?.patient?.firstName || ""} {t?.patient?.lastName || ""}
                  </td>
                  <td>
                    {t?.fromHospital?.name || t?.fromHospital?.code || "—"} →{" "}
                    {t?.toHospital?.name || t?.toHospital?.code || "—"}
                  </td>
                  <td>{translateText(t.status)}</td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted">
                    {translateText("No transfers yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("AI Workforce Intelligence")} subtitle={translateText("Auto-refresh signals that help prioritize staffing and training interventions.")}>
        <div className="grid info-grid">
          <StatCard
            title={translateText("Burnout Score")}
            value={burnout?.score ?? "—"}
            trend={trend.burnoutScore}
            subtitle={translateText("Auto-refresh 45s")}
            status={burnoutStatus(burnout?.score)}
            badge={badgeFromStatus(burnoutStatus(burnout?.score))}
            why={translateText(`Burnout score ${burnout?.score ?? 0}; >=75 high risk, 45-74 medium.`)}
            path="/app/people/requests/index?status=PENDING"
          />
          <StatCard
            title={translateText("Burnout Band")}
            value={burnout?.band ?? "—"}
            path="/app/people/requests/index?status=PENDING"
          />
          <StatCard
            title={translateText("Projected KPI")}
            value={causal?.projected ?? "—"}
            trend={trend.projectedKpi}
            subtitle={translateText("Auto-refresh 45s")}
            status={changeStatus(causal?.changePct)}
            badge={badgeFromStatus(changeStatus(causal?.changePct))}
            why={translateText(`Projected KPI is ${causal?.projected ?? 0}; negative expected change means risk.`)}
            path="/app/people/staff/register"
          />
          <StatCard
            title={translateText("Projected Change %")}
            value={causal?.changePct ?? "—"}
            trend={trend.projectedChange}
            subtitle={translateText("Auto-refresh 45s")}
            status={changeStatus(causal?.changePct)}
            badge={badgeFromStatus(changeStatus(causal?.changePct))}
            why={translateText(`Change ${causal?.changePct ?? 0}%; <0 is risk, 0-3 is watch.`)}
            path="/app/people/staff/register"
          />
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}

