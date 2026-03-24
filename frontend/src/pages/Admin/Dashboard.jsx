import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActionCard, StatCard } from "../../components/Cards";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
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
    <DashboardHomeShell
      className="page-admin-dashboard"
      kicker="Admin workspace"
      title="Admin Tools"
      subtitle="Control governance, audit visibility, AI traceability, and human assistant operations from one premium command surface."
      actions={[
        { label: "Open Audit Logs", path: "/admin/audit-logs" },
        { label: "Open AI Autofill Audit", path: "/admin/ai-autofill-audit", variant: "secondary" },
        { label: "Create Admin", path: "/admin/create-admin", variant: "secondary" },
        { label: "Super Assistants", path: "/admin/super-assistants", variant: "secondary" },
      ]}
      stats={[
        { label: "Transfer feed", value: transfers.length, note: "Live continuity stream" },
        { label: "Pending handoffs", value: transfers.filter((t) => t.status === "Pending").length, note: "Needs admin follow-up" },
        { label: "Audit posture", value: "Tracked", note: "Governance signals visible" },
      ]}
      contextCards={[
        {
          title: "Operations focus",
          subtitle: "What deserves the next admin action.",
          items: [
            { label: "Pending transfers", value: transfers.filter((t) => t.status === "Pending").length, tone: "warn" },
            { label: "Latest feed size", value: transfers.length },
            { label: "Continuity status", value: transferError ? "Attention needed" : "Healthy", tone: transferError ? "risk" : "good" },
          ],
          actions: [
            { label: "Open Transfer Continuity", path: "/hospital-admin/transfer-command-center", variant: "secondary" },
            { label: "Review Audit Logs", path: "/admin/audit-logs" },
          ],
        },
        {
          title: "Governance runway",
          subtitle: "High-value tools for today's admin desk.",
          items: [
            { label: "Assistant operations", value: "Ready" },
            { label: "Access governance", value: "Live" },
            { label: "AI review", value: "Enabled" },
          ],
          actions: [
            { label: "Manage Super Assistants", path: "/admin/super-assistants", variant: "secondary" },
            { label: "Open Access Control", path: "/admin/access-control", variant: "secondary" },
          ],
        },
      ]}
    >
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
      </DashboardSection>
    </DashboardHomeShell>
  );
}
