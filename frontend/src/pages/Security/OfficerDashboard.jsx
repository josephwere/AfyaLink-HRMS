import React, { useEffect, useMemo, useState } from "react";
import { StatCard } from "../../components/Cards";
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

export default function SecurityOfficerDashboard() {
  const { user } = useAuth();
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
  }, []);

  const accessCode = useMemo(() => (verifyResult?.person ? code : ""), [verifyResult, code]);

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
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Security Officer Field Console</h2>
          <p className="muted">Current shift execution, visitor flow, gate scanning and incident response.</p>
        </div>
      </div>

      <section className="section">
        <h3>Shift & Zone</h3>
        <div className="grid info-grid">
          <StatCard title="Current Shift" value="Active" />
          <StatCard title="Assigned Zone" value={user?.hospital || "Main"} />
          <StatCard title="Open Incidents" value={data?.openIncidents ?? "—"} />
          <StatCard title="Incidents Today" value={data?.incidentsToday ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Register Guest / Worker Access</h3>
          <form className="grid info-grid" onSubmit={onBookVisitor}>
            <input
              value={visitorForm.fullName}
              onChange={(e) => setVisitorForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Full name"
              required
            />
            <input
              value={visitorForm.phone}
              onChange={(e) => setVisitorForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone"
              required
            />
            <input
              value={visitorForm.idNumber}
              onChange={(e) => setVisitorForm((p) => ({ ...p, idNumber: e.target.value }))}
              placeholder="ID / Passport"
            />
            <input
              value={visitorForm.purpose}
              onChange={(e) => setVisitorForm((p) => ({ ...p, purpose: e.target.value }))}
              placeholder="Purpose"
              required
            />
            <input
              type="datetime-local"
              value={visitorForm.expiresAt}
              onChange={(e) => setVisitorForm((p) => ({ ...p, expiresAt: e.target.value }))}
              required
            />
            <button className="btn-primary" type="submit" disabled={busy}>Save Access</button>
          </form>
          {msg ? <p className="muted">{msg}</p> : null}
        </div>
        <div className="card doctor-alerts-card">
          <h3>Gate Verification</h3>
          <div className="grid info-grid">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Access code" />
            <button className="btn-secondary" onClick={onVerify} disabled={busy || !code}>Verify</button>
            <button className="btn-secondary" onClick={onCheckIn} disabled={busy || !accessCode}>Check In</button>
            <button className="btn-secondary" onClick={onCheckOut} disabled={busy || !accessCode}>Check Out</button>
          </div>
          {verifyResult ? (
            <div className="alert-stack">
              <div className="alert-item">Status: {verifyResult.status}</div>
              <div className="alert-item">Person: {verifyResult.person?.fullName || verifyResult.person?.name || "N/A"}</div>
              <div className="alert-item">Type: {verifyResult.personType || "N/A"}</div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>People Currently Inside</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Checked In</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {(inside || []).slice(0, 8).map((row) => (
                  <tr key={row._id}>
                    <td>{row.personRef?.fullName || row.personRef?.name || "Unknown"}</td>
                    <td>{row.personType}</td>
                    <td>{row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : "-"}</td>
                    <td>{row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
                {!inside?.length ? (
                  <tr>
                    <td colSpan={4}>No active entries</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Latest Access Logs</h3>
          <div className="alert-stack">
            {(logs || []).slice(0, 8).map((row) => (
              <div key={row._id} className="alert-item">
                <strong>{row.code}</strong> {row.personType} - {row.status}
              </div>
            ))}
            {!logs?.length ? <div className="alert-item">No logs available</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
