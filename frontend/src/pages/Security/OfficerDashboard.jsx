import React from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useSecurityOfficerDashboard } from "../../hooks/useSecurityOfficerDashboard";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function SecurityOfficerDashboard() {
  const { translateText } = useAppLanguage();
  const {
    user,
    data,
    logs,
    inside,
    msg,
    busy,
    visitorForm,
    setVisitorForm,
    code,
    setCode,
    verifyResult,
    transfers,
    transferError,
    accessCode,
    pendingTransfers,
    onBookVisitor,
    onVerify,
    onCheckIn,
    onCheckOut,
  } = useSecurityOfficerDashboard();

  return (
    <DashboardHomeShell
      shellKey="platform_security_officer"
      kicker={translateText("Platform")}
      title={translateText("Security Officer")}
      subtitle={translateText("Access checks, visitor management, and incident routing without clutter.")}
      actions={[
        { label: translateText("Emergency Command"), path: "/app/operations/emergency/command" },
        { label: translateText("Transfer Command"), path: "/app/operations/transfers/command", variant: "secondary" },
        { label: translateText("My Requests"), path: "/app/people/requests/index", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Shift"), value: translateText("Active") },
        { label: translateText("Zone"), value: user?.hospital || translateText("Main") },
        { label: translateText("Open Incidents"), value: data?.openIncidents ?? "—", path: "/app/operations/emergency/command" },
        { label: translateText("Pending Transfers"), value: pendingTransfers, path: "/app/operations/transfers/command" },
      ]}
    >
      {msg ? <div className="card">{translateText(msg)}</div> : null}

      <DashboardSection title={translateText("Register Guest / Worker Access")} subtitle={translateText("Create time-bound visitor or contractor access codes.")}>
        <form className="grid info-grid" onSubmit={onBookVisitor}>
          <input
            value={visitorForm.fullName}
            onChange={(e) => setVisitorForm((p) => ({ ...p, fullName: e.target.value }))}
            placeholder={translateText("Full name")}
            required
          />
          <input
            value={visitorForm.phone}
            onChange={(e) => setVisitorForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder={translateText("Phone")}
            required
          />
          <input
            value={visitorForm.idNumber}
            onChange={(e) => setVisitorForm((p) => ({ ...p, idNumber: e.target.value }))}
            placeholder={translateText("ID / Passport")}
          />
          <input
            value={visitorForm.purpose}
            onChange={(e) => setVisitorForm((p) => ({ ...p, purpose: e.target.value }))}
            placeholder={translateText("Purpose")}
            required
          />
          <input
            type="datetime-local"
            value={visitorForm.expiresAt}
            onChange={(e) => setVisitorForm((p) => ({ ...p, expiresAt: e.target.value }))}
            required
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {translateText("Save Access")}
          </button>
        </form>
      </DashboardSection>

      <DashboardSection title={translateText("Gate Verification")} subtitle={translateText("Verify codes and record check-in / check-out.")}>
        <div className="grid info-grid">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={translateText("Access code")}
          />
          <button type="button" className="btn-secondary" onClick={onVerify} disabled={busy || !code}>
            {translateText("Verify")}
          </button>
          <button type="button" className="btn-secondary" onClick={onCheckIn} disabled={busy || !accessCode}>
            {translateText("Check In")}
          </button>
          <button type="button" className="btn-secondary" onClick={onCheckOut} disabled={busy || !accessCode}>
            {translateText("Check Out")}
          </button>
        </div>
        {verifyResult ? (
          <div className="alert-stack" style={{ marginTop: 12 }}>
            <div className="alert-item">
              {translateText("Status")}: {translateText(verifyResult.status)}
            </div>
            <div className="alert-item">
              {translateText("Person")}: {verifyResult.person?.fullName || verifyResult.person?.name || translateText("N/A")}
            </div>
            <div className="alert-item">
              {translateText("Type")}: {translateText(verifyResult.personType || "N/A")}
            </div>
          </div>
        ) : null}
      </DashboardSection>

      <DashboardSection title={translateText("People Currently Inside")} subtitle={translateText("Live occupancy from access logs.")}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText("Name")}</th>
                <th>{translateText("Type")}</th>
                <th>{translateText("Checked In")}</th>
                <th>{translateText("Expires")}</th>
              </tr>
            </thead>
            <tbody>
              {(inside || []).slice(0, 8).map((row) => (
                <tr key={row._id}>
                  <td>{row.personRef?.fullName || row.personRef?.name || translateText("Unknown")}</td>
                  <td>{translateText(row.personType)}</td>
                  <td>{row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : "—"}</td>
                  <td>{row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {!inside?.length ? (
                <tr>
                  <td colSpan={4}>{translateText("No entries")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Latest Access Logs")} subtitle={translateText("Recent access events for quick audit.")}>
        <div className="alert-stack">
          {(logs || []).slice(0, 8).map((row) => (
            <div key={row._id} className="alert-item">
              <strong>{row.code}</strong> {translateText(row.personType)} - {translateText(row.status)}
            </div>
          ))}
          {!logs?.length ? <div className="alert-item">{translateText("No logs")}</div> : null}
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Security watchlist for transfer handover periods.")}>
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
          <div className="alert-item">{translateText("Check visitor logs during transfer windows.")}</div>
          <div className="alert-item">{translateText("Flag unknown entries during transfer handoff.")}</div>
          <div className="alert-item">{translateText("Report incidents tied to transfer movement.")}</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
