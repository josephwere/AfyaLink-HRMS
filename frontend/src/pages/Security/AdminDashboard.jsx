import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useSecurityAdminDashboard } from "../../hooks/useSecurityAdminDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function SecurityAdminDashboard() {
  const { translateText } = useAppLanguage();
  const {
    data,
    alerts,
    overstays,
    logs,
    staffQ,
    setStaffQ,
    staffOptions,
    selectedStaff,
    setSelectedStaff,
    msg,
    busy,
    transfers,
    transferError,
    pendingTransfers,
    internalForm,
    setInternalForm,
    selectedStaffLabel,
    onBookInternal,
  } = useSecurityAdminDashboard();

  return (
    <DashboardHomeShell
      shellKey="platform_security_admin"
      kicker={translateText("Platform")}
      title={translateText("Security Administration")}
      subtitle={translateText("Access control, visitor policy, overstays, and incident escalation for the facility.")}
      actions={[
        { label: translateText("Access Control"), path: "/app/platform/security/access-control" },
        { label: translateText("Emergency Command"), path: "/app/operations/emergency/command", variant: "secondary" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Active Access Points"), value: data?.officersActive ?? "—", path: "/app/platform/security/access-control" },
        { label: translateText("Open Incidents"), value: data?.openIncidents ?? "—", path: "/app/operations/emergency/command" },
        { label: translateText("Escalated Incidents"), value: data?.escalatedIncidents ?? "—", path: "/app/operations/emergency/command" },
        { label: translateText("Incidents Today"), value: data?.incidentsToday ?? "—", path: "/app/operations/emergency/command" },
      ]}
    >
      {msg ? <div className="card">{translateText(msg)}</div> : null}

      <DashboardSection title={translateText("Grant Internal Access")} subtitle={translateText("Issue time-bound internal access for staff, vendors, and contractors.")}>
        <form className="grid info-grid" onSubmit={onBookInternal}>
          <input
            value={staffQ}
            onChange={(e) => setStaffQ(e.target.value)}
            placeholder={translateText("Search staff / contractor")}
          />
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} required>
            <option value="">{selectedStaffLabel ? selectedStaffLabel : translateText("Select user")}</option>
            {staffOptions.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.email}) - {u.role}
              </option>
            ))}
          </select>
          <select
            value={internalForm.personType}
            onChange={(e) => setInternalForm((p) => ({ ...p, personType: e.target.value }))}
          >
            <option value="STAFF">{translateText("STAFF")}</option>
            <option value="CONTRACTOR">{translateText("CONTRACTOR")}</option>
            <option value="VENDOR">{translateText("VENDOR")}</option>
            <option value="SECURITY">{translateText("SECURITY")}</option>
          </select>
          <input
            value={internalForm.purpose}
            onChange={(e) => setInternalForm((p) => ({ ...p, purpose: e.target.value }))}
            placeholder={translateText("Purpose")}
            required
          />
          <input
            type="datetime-local"
            value={internalForm.expiresAt}
            onChange={(e) => setInternalForm((p) => ({ ...p, expiresAt: e.target.value }))}
            required
          />
          <button className="btn-primary" type="submit" disabled={busy || !selectedStaff}>
            {translateText("Grant Access")}
          </button>
        </form>
        {msg ? <p className="muted">{translateText(msg)}</p> : null}
      </DashboardSection>

      <DashboardSection title={translateText("Overstays")} subtitle={translateText("Access sessions that have expired but remain open.")}>
        <div className="alert-stack">
          {(overstays || []).slice(0, 8).map((row) => (
            <div key={row._id} className="alert-item">
              {row.personRef?.fullName || row.personRef?.name || translateText("Unknown")} - {translateText("expired")}{" "}
              {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : ""}
            </div>
          ))}
          {!overstays?.length ? <div className="alert-item">{translateText("No overstay cases")}</div> : null}
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Latest Security Alerts")} subtitle={translateText("Recent actions and security events for triage.")}>
        <div className="alert-stack">
          {(alerts || []).slice(0, 10).map((a) => (
            <div key={a._id} className="alert-item">
              <strong>{translateText(a.action)}</strong> - {a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}
            </div>
          ))}
          {!alerts?.length ? <div className="alert-item">{translateText("No alerts")}</div> : null}
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Latest Access Logs")} subtitle={translateText("Recent access codes, types, and statuses for quick audit.")}>
        <div className="alert-stack">
          {(logs || []).slice(0, 10).map((row) => (
            <div key={row._id} className="alert-item">
              <strong>{row.code}</strong> {translateText(row.personType)} - {translateText(row.status)}
            </div>
          ))}
          {!logs?.length ? <div className="alert-item">{translateText("No access logs")}</div> : null}
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Security follow-up for transfer-related access and handover paths.")}>
        <div className="action-pill" style={{ marginBottom: 12 }}>
          {translateText("Pending")}: {pendingTransfers}
        </div>
        {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
        <div className="table-wrap">
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

      <DashboardSection title={translateText("Continuity Actions")} subtitle={translateText("What to do next.")}>
        <div className="alert-stack">
          <div className="alert-item">{translateText("Validate access logs for transfer-related entries.")}</div>
          <div className="alert-item">{translateText("Review any incidents tied to transfer handover.")}</div>
          <div className="alert-item">{translateText("Escalate suspicious access during transfer windows.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
