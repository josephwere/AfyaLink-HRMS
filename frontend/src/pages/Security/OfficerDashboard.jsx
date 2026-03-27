import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../utils/auth";
import { getSecurityOfficerDashboard } from "../../services/dashboardApi";
import {
  bookVisitorAccess,
  checkInAccess,
  checkOutAccess,
  getAccessLogs,
  getLiveOccupancy,
  verifyAccessCode,
} from "../../services/securityAccessApi";
import { listTransfers } from "../../services/transferApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function SecurityOfficerDashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [inside, setInside] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    fullName: "",
    phone: "",
    idNumber: "",
    purpose: "",
    expiresAt: "",
  });
  const [code, setCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    Promise.all([
      getSecurityOfficerDashboard().catch(() => null),
      getAccessLogs({ limit: 10 }).catch(() => ({ items: [] })),
      getLiveOccupancy().catch(() => ({ peopleInside: [] })),
    ]).then(([dash, logRes, live]) => {
      setData(dash);
      setLogs(logRes?.items || []);
      setInside(live?.peopleInside || []);
    });
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
  }, []);

  const accessCode = useMemo(() => (verifyResult?.person ? code : ""), [verifyResult, code]);
  const pendingTransfers = transfers.filter(
    (t) => String(t?.status || "").toUpperCase() === "PENDING"
  ).length;

  const refreshPanels = async () => {
    const [logRes, live] = await Promise.all([
      getAccessLogs({ limit: 10 }).catch(() => ({ items: [] })),
      getLiveOccupancy().catch(() => ({ peopleInside: [] })),
    ]);
    setLogs(logRes?.items || []);
    setInside(live?.peopleInside || []);
  };

  const onBookVisitor = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        ...visitorForm,
        expiresAt: new Date(visitorForm.expiresAt).toISOString(),
      };
      const res = await bookVisitorAccess(payload);
      setMsg(`Visitor booked. Access code: ${res.accessCode}`);
      setVisitorForm({ fullName: "", phone: "", idNumber: "", purpose: "", expiresAt: "" });
      await refreshPanels();
    } catch (err) {
      setMsg(err?.message || "Failed to book visitor");
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await verifyAccessCode({ code });
      setVerifyResult(res);
      setMsg(`Verification: ${res.status}${res?.emergency ? " (Emergency override)" : ""}`);
    } catch (err) {
      setVerifyResult(null);
      setMsg(err?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const onCheckIn = async () => {
    setBusy(true);
    setMsg("");
    try {
      await checkInAccess({ code: accessCode });
      setMsg("Check-in successful");
      await refreshPanels();
    } catch (err) {
      setMsg(err?.message || "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  const onCheckOut = async () => {
    setBusy(true);
    setMsg("");
    try {
      await checkOutAccess({ code: accessCode });
      setMsg("Check-out successful");
      await refreshPanels();
    } catch (err) {
      setMsg(err?.message || "Check-out failed");
    } finally {
      setBusy(false);
    }
  };

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
