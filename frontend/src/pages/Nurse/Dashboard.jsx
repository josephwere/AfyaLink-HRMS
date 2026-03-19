import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getNurseDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";

export default function NurseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getNurseDashboard().then(setData).catch(() => setData(null));
    listTransfers({ limit: 6, scope: "facility" })
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
          <h2>Nurse Clinical Operations</h2>
          <p className="muted">Daily nursing tasks in one clear workspace.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" type="button" onClick={() => navigate("/nurse/shift")}>Open Shift</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/nurse/vitals")}>Record Vitals</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/nurse/medication")}>Give Medication</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/nurse/ward-board")}>Ward Board</button>
        </div>
      </div>

      <section className="section">
        <h3>Nursing Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Shift Info" value="Active" onClick={() => navigate("/nurse/shift")} />
          <StatCard title="Assigned Patients" value={data?.patientsTotal ?? "—"} onClick={() => navigate("/nurse/patients")} />
          <StatCard title="Medication Due Alerts" value={data?.pendingLabOrders ?? "—"} onClick={() => navigate("/nurse/medication")} />
          <StatCard title="Pending Requests" value={data?.pendingRequests?.total ?? "—"} onClick={() => navigate("/nurse/ward-board")} />
          <StatCard title="Open Escalations" value={data?.escalationSummary?.openCount ?? "—"} onClick={() => navigate("/nurse/patients")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Main Tasks</h3>
          <div className="panel-grid">
            <button className="action-link" type="button" onClick={() => navigate("/nurse/patients")}>Patient Task List</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/medication")}>Medication Administration</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/vitals")}>Vitals Entry</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/ward-board")}>Ward Board</button>
            <button className="action-link" type="button" onClick={() => navigate("/nurse/incidents")}>Incident Reports</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Critical Alerts: {data?.appointmentsToday ?? "—"}</div>
            <div className="action-pill">Leave Pending: {data?.pendingRequests?.leave ?? "—"}</div>
            <button className="btn-secondary" type="button" onClick={() => navigate("/workforce/requests")}>Open My Requests</button>
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
            <div className="action-pill">
              Pending: {transfers.filter((t) => t.status === "Pending").length}
            </div>
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
            <button className="btn-secondary" type="button" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/nurse/ward-board")}>
              Ward Board
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Handoff Checklist</h3>
          <div className="alert-stack">
            <div className="alert-item">Confirm vitals and meds before transfer handoff.</div>
            <div className="alert-item">Log outstanding labs or imaging for receiving team.</div>
            <div className="alert-item">Escalate missing consent to the command center.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Escalation Board</h3>
              <p className="muted">Blocked discharge and transfer issues waiting for clinician action.</p>
            </div>
            <div className="action-pill">Open: {data?.escalationSummary?.openCount ?? 0}</div>
          </div>
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {(data?.escalationSummary?.items || []).slice(0, 6).map((item) => (
              <div key={item.id} className="card">
                <div className="card-header-actions">
                  <div>
                    <strong>{item.patientName}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.resolvedAt ? "Resolved" : "Awaiting clinician review"}
                      {item.missingRequirements?.length ? ` • Missing: ${item.missingRequirements.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className={`action-pill${item.resolvedAt ? "" : " warning"}`}>
                    {item.resolvedAt ? "Resolved" : "Open"}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{item.body || item.title}</p>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(item.patientId ? `/nurse/vitals?patientId=${item.patientId}` : "/nurse/vitals")}
                  >
                    Open Patient
                  </button>
                </div>
              </div>
            ))}
            {!(data?.escalationSummary?.items || []).length ? (
              <div className="action-pill">No escalation activity yet.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
