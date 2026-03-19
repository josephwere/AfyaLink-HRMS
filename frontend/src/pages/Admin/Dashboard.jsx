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
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
        Admin Tools
      </h1>

      <div className="grid" style={{ marginBottom: 24 }}>
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

      <section className="section" style={{ marginTop: 24 }}>
        <div className="card">
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
