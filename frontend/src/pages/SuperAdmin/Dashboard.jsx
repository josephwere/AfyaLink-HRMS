import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import apiFetch from "../../utils/apiFetch";
import { triggerAction } from "../../services/actionApi";
import { getSuperAdminDashboard } from "../../services/dashboardApi";
import { getDeveloperOverview } from "../../services/developerApi";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ops, setOps] = useState(null);
  const [msg, setMsg] = useState("");
  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [unlinkedPharmacists, setUnlinkedPharmacists] = useState(0);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getSuperAdminDashboard().then(setData).catch(() => setData(null));
    getDeveloperOverview().then(setOps).catch(() => setOps(null));
    apiFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500")
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        setUnlinkedPharmacists(rows.length);
      })
      .catch(() => setUnlinkedPharmacists(0));
    listTrainingTrackers({ limit: 300 })
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
    listTransfers({ limit: 10, scope: "global" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Super Admin Dashboard</h2>
          <p className="muted">Simple global view for hospitals, staff, security, and system status.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/super-admin/hospitals")}>Hospitals</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/create-admin")}>Role Management</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/super-assistants")}>Super Assistants</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/payments/full")}>Global Payroll</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/super-admin/settings")}>System Settings</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/super-admin/pharmacies")}>Registered Pharmacies</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}>Training Tracker</button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Global Snapshot</h3>
        <div className="grid info-grid">
          <StatCard
            title="Total Hospitals"
            value={data?.totalHospitals ?? "—"}
            onClick={() => navigate("/super-admin/hospitals")}
          />
          <StatCard title="Total Staff" value={data?.totalUsers ?? "—"} onClick={() => navigate("/admin/access-control")} />
          <StatCard title="Active Patients" value={data?.totalPatients ?? "—"} onClick={() => navigate("/system-admin/patient-identity-registry")} />
          <StatCard title="Payroll This Month" value={data?.paymentsThisMonth ?? "—"} onClick={() => navigate("/payments/full")} />
          <StatCard title="Workforce Pending" value={ops?.queues?.workforce?.totalPending ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Workforce Breached" value={ops?.queues?.workforce?.breached ?? "—"} onClick={() => navigate("/developer/queue-replay")} />
          <StatCard title="Total Pharmacists" value={data?.pharmacists ?? "—"} onClick={() => navigate("/super-admin/pharmacies")} />
          <StatCard
            title="Unlinked Pharmacists"
            value={unlinkedPharmacists}
            onClick={() => navigate("/system-admin/pharmacy-access-audit")}
          />
          <StatCard
            title="Training Completion %"
            value={training.completionRate}
            subtitle={`${training.completed}/${training.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
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
            <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/county-command-center")}>
              County Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Review consent gaps before transfer exports.</div>
            <div className="alert-item">Monitor handover completion for inter-facility transfers.</div>
            <div className="alert-item">Escalate delays through county command center.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Training Tracker</h3>
        <div className="grid info-grid">
          <StatCard title="Total Trainees" value={training.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title="Not Started" value={training.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="In Progress" value={training.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title="Completed" value={training.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title="Overdue Not Started" value={training.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="Overdue In Progress" value={training.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Main Tasks</h3>
          <div className="panel-grid">
            <button
              type="button"
              className="action-link"
              onClick={async () => {
                try {
                  await triggerAction("REVENUE_OVERVIEW");
                  setMsg("");
                } catch (e) {
                  setMsg(e?.message || "Unable to load revenue action right now.");
                } finally {
                  navigate("/payments/full");
                }
              }}
            >
              Revenue Graph
            </button>
            <button type="button" className="action-link" onClick={() => navigate("/analytics")}>Workforce Distribution</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Compliance Alerts</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
            <button type="button" className="action-link" onClick={() => navigate("/security-admin")}>Security Incidents</button>
            <button type="button" className="action-link" onClick={() => navigate("/system-admin")}>System Status Monitor</button>
            <button type="button" className="action-link" onClick={() => navigate("/super-admin/pharmacies")}>Pharmacy Registry</button>
            <button type="button" className="action-link" onClick={() => navigate("/system-admin/pharmacy-access-audit")}>Pharmacy Access Audit</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=HOSPITAL_ADMIN&status=NOT_STARTED")}>Training Tracker Board</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Active Sessions: {data?.activeHospitals ?? "—"}</div>
            <div className="action-pill">Pending Requests: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">Invoices: {data?.invoicesThisMonth ?? "—"}</div>
            <div className="action-pill">Hospitals With Pharmacists: {data?.hospitalsWithPharmacists ?? "—"}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/notifications")}>Open Alerts</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>System Administration</h3>
        <div className="action-list">
          <button type="button" className="action-link" onClick={() => navigate("/admin/realtime")}>Integration Hub</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/crdt-patients")}>Offline Sync</button>
          <button type="button" className="action-link" onClick={() => navigate("/admin/audit-logs")}>Audit Trails</button>
          <button type="button" className="action-link" onClick={() => navigate("/reports")}>Regulatory Reports</button>
        </div>
      </section>
    </div>
  );
}
