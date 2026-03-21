import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { listTransfers } from "../../services/transferApi";

export default function Dashboard() {
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    listTransfers({ limit: 6, scope: "global" })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });
  }, []);

  return (
    <div className="dashboard premium-shell page-admin-dashboard">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Admin workspace</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Admin Tools</h1>
            <p className="premium-shell-subtitle">
              Control governance, audit visibility, AI traceability, and human assistant operations from one premium command surface.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Transfer feed</span>
              <strong>{transfers.length}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Pending handoffs</span>
              <strong>{transfers.filter((t) => t.status === "Pending").length}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="grid page-admin-dashboard__stats">
        <StatCard title="Audit Logs" value="Live" subtitle="Security events" path="/admin/audit-logs" />
        <StatCard title="AI Autofill Audit" value="Review" subtitle="Draft/apply trace" path="/admin/ai-autofill-audit" />
        <StatCard title="Admin Accounts" value="Manage" subtitle="Create and review" path="/admin/create-admin" />
        <StatCard title="Super Assistants" value="Manage" subtitle="Human assistant team" path="/admin/super-assistants" />
        <StatCard title="System Access" value="RBAC" subtitle="Role governance" path="/admin/access-control" />
      </div>

      <div className="welcome-actions">
        <Link to="/admin/audit-logs">Open Audit Logs</Link>
        <Link to="/admin/ai-autofill-audit">Open AI Autofill Audit</Link>
        <Link to="/admin/create-admin">Create Admin</Link>
        <Link to="/admin/super-assistants">Super Assistants</Link>
      </div>

      <section className="section">
        <div className="card premium-card">
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
          <div className="table-wrap">
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
                    <td>
                      {t?.fromHospital?.name || t?.fromHospital?.code || "—"} →{" "}
                      {t?.toHospital?.name || t?.toHospital?.code || "—"}
                    </td>
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
        </div>
      </section>
    </div>
  );
}
