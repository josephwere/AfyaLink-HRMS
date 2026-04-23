import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActionCard, StatCard } from "../../components/Cards";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import apiFetch from "../../utils/apiFetch";
import { listSupportTickets } from "../../services/opsApi";
import { listTransfers } from "../../services/transferApi";

export default function Dashboard() {
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [metrics, setMetrics] = useState({
    hospitals: 0,
    staff: 0,
    supportTickets: 0,
  });
  const [metricsError, setMetricsError] = useState("");

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

  useEffect(() => {
    let active = true;

    Promise.all([
      apiFetch("/api/hospitals?limit=1"),
      apiFetch("/api/users?limit=1&includeInactive=1"),
      listSupportTickets({ limit: 1 }),
    ])
      .then(([hospitals, users, support]) => {
        if (!active) return;
        setMetrics({
          hospitals: Number(hospitals?.total || 0),
          staff: Number(users?.total || 0),
          supportTickets: Number(support?.total ?? support?.count ?? 0),
        });
        setMetricsError("");
      })
      .catch((err) => {
        if (!active) return;
        setMetrics({
          hospitals: 0,
          staff: 0,
          supportTickets: 0,
        });
        setMetricsError(err?.message || "Unable to load live operations counts.");
      });

    return () => {
      active = false;
    };
  }, []);

  const pendingTransfers = transfers.filter((t) => t.status === "Pending").length;

  return (
    <DashboardHomeShell
      className="page-admin-dashboard"
      kicker="Admin workspace"
      title="Admin Tools"
      subtitle="Monitor governance, hospitals, staff capacity, support queues, and transfer continuity from live platform data."
      actions={[
        { label: "Open Audit Logs", path: "/admin/audit-logs" },
        { label: "Open AI Autofill Audit", path: "/admin/ai-autofill-audit", variant: "secondary" },
        { label: "Create Admin", path: "/admin/create-admin", variant: "secondary" },
        { label: "Super Assistants", path: "/admin/super-assistants", variant: "secondary" },
      ]}
      stats={[
        { label: "Hospitals", value: metrics.hospitals, note: "Database total" },
        { label: "Staff accounts", value: metrics.staff, note: "Database total" },
        { label: "Pending handoffs", value: pendingTransfers, note: "Needs admin follow-up" },
        { label: "Support queue", value: metrics.supportTickets, note: "Live ticket total" },
      ]}
      contextCards={[
        {
          title: "Operations focus",
          subtitle: "What deserves the next admin action from live database signals.",
          items: [
            { label: "Pending transfers", value: pendingTransfers, tone: "warn" },
            { label: "Hospitals", value: metrics.hospitals },
            {
              label: "Continuity status",
              value: transferError || metricsError ? "Attention needed" : "Healthy",
              tone: transferError || metricsError ? "risk" : "good",
            },
          ],
          actions: [
            { label: "Open Transfer Continuity", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
            { label: "Review Audit Logs", path: "/admin/audit-logs" },
          ],
        },
        {
          title: "Governance runway",
          subtitle: "Real counts for today's admin desk.",
          items: [
            { label: "Staff accounts", value: metrics.staff },
            { label: "Support tickets", value: metrics.supportTickets },
            {
              label: "Audit review",
              value: metricsError ? "Retry needed" : "Live",
              tone: metricsError ? "warn" : "good",
            },
          ],
          actions: [
            { label: "Manage Super Assistants", path: "/admin/super-assistants", variant: "secondary" },
            { label: "Open Access Control", path: "/admin/access-control", variant: "secondary" },
          ],
        },
      ]}
    >
      {metricsError ? <div className="premium-inline-note">{metricsError}</div> : null}

      <DashboardSection title="Live platform totals" subtitle="Database counts for the main admin scope.">
        <div className="grid page-admin-dashboard__stats">
          <StatCard title="Hospitals" value={metrics.hospitals} subtitle="Live database total" />
          <StatCard title="Staff Accounts" value={metrics.staff} subtitle="Users in active scope" />
          <StatCard title="Support Tickets" value={metrics.supportTickets} subtitle="Current ticket workload" />
        </div>
      </DashboardSection>

      <DashboardSection title="Command surface" subtitle="Core admin tools arranged as clear operational cards.">
        <div className="grid page-admin-dashboard__stats">
          <ActionCard title="Audit Logs" description="Review security events, access traces, and critical governance activity." eyebrow="Security" path="/admin/audit-logs" badge="Live" />
          <ActionCard title="AI Autofill Audit" description="Inspect reviewed drafts, confidence, evidence, and apply history." eyebrow="AI Oversight" path="/admin/ai-autofill-audit" badge="Review" />
          <ActionCard title="Admin Accounts" description="Create, review, and update the internal admin team with safer workflows." eyebrow="Identity" path="/admin/create-admin" badge="Manage" />
          <ActionCard title="Super Assistants" description="Coordinate human assistants, invites, bulk actions, and productivity metrics." eyebrow="Operations" path="/admin/super-assistants" badge="Team" />
          <ActionCard title="System Access" description="Keep role governance, RBAC, and internal access posture organized in one place." eyebrow="Control" path="/admin/access-control" badge="RBAC" />
        </div>
      </DashboardSection>

      <div className="welcome-actions">
        <Link to="/admin/audit-logs">Open Audit Logs</Link>
        <Link to="/admin/ai-autofill-audit">Open AI Autofill Audit</Link>
        <Link to="/admin/create-admin">Create Admin</Link>
        <Link to="/admin/super-assistants">Super Assistants</Link>
      </div>

      <DashboardSection title="Transfer continuity" subtitle="Recent transfers and handoff status across the admin surface.">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {pendingTransfers}</div>
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
                    <td>
                      {t?.patient?.firstName || ""} {t?.patient?.lastName || ""}
                    </td>
                    <td>
                      {t?.fromHospital?.name || t?.fromHospital?.code || "—"} →{" "}
                      {t?.toHospital?.name || t?.toHospital?.code || "—"}
                    </td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">
                      No transfers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
