import React, { useEffect, useMemo, useState } from "react";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getSecurityAdminDashboard } from "../../services/dashboardApi";
import {
  bookInternalAccess,
  getAccessLogs,
  getOverstays,
  getSecurityAlerts,
  searchUsersForAccess,
} from "../../services/securityAccessApi";
import { listTransfers } from "../../services/transferApi";

export default function SecurityAdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [overstays, setOverstays] = useState([]);
  const [logs, setLogs] = useState([]);
  const [staffQ, setStaffQ] = useState("");
  const [staffOptions, setStaffOptions] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [internalForm, setInternalForm] = useState({
    personType: "CONTRACTOR",
    purpose: "",
    expiresAt: "",
  });

  useEffect(() => {
    Promise.all([
      getSecurityAdminDashboard().catch(() => null),
      getSecurityAlerts().catch(() => ({ alerts: [] })),
      getOverstays().catch(() => ({ overstayed: [] })),
      getAccessLogs({ limit: 12 }).catch(() => ({ items: [] })),
    ]).then(([dash, a, o, l]) => {
      setData(dash);
      setAlerts(a?.alerts || []);
      setOverstays(o?.overstayed || []);
      setLogs(l?.items || []);
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

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!staffQ.trim()) {
        setStaffOptions([]);
        return;
      }
      try {
        const out = await searchUsersForAccess({ q: staffQ.trim(), limit: 20 });
        setStaffOptions(out?.items || []);
      } catch {
        setStaffOptions([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [staffQ]);

  const selectedStaffLabel = useMemo(
    () => staffOptions.find((u) => u._id === selectedStaff)?.name || "",
    [selectedStaff, staffOptions]
  );

  const onBookInternal = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await bookInternalAccess({
        personRef: selectedStaff,
        personType: internalForm.personType,
        purpose: internalForm.purpose,
        expiresAt: new Date(internalForm.expiresAt).toISOString(),
      });
      setMsg(`Internal access created. Code: ${res.accessCode}`);
      setSelectedStaff("");
      setStaffQ("");
      setInternalForm({ personType: "CONTRACTOR", purpose: "", expiresAt: "" });
    } catch (err) {
      setMsg(err?.message || "Failed to grant internal access");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Security Admin Dashboard</h2>
          <p className="muted">Simple security admin view for access, visitors, and incident control.</p>
        </div>
      </div>

      <section className="section">
        <h3>Security Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Active Access Points" value={data?.officersActive ?? "—"} />
          <StatCard title="Open Incidents" value={data?.openIncidents ?? "—"} />
          <StatCard title="Escalated Incidents" value={data?.escalatedIncidents ?? "—"} />
          <StatCard title="Incidents Today" value={data?.incidentsToday ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Grant Internal Access</h3>
          <form className="grid info-grid" onSubmit={onBookInternal}>
            <input
              value={staffQ}
              onChange={(e) => setStaffQ(e.target.value)}
              placeholder="Search staff / contractor"
            />
            <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} required>
              <option value="">{selectedStaffLabel ? selectedStaffLabel : "Select user"}</option>
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
              <option value="STAFF">STAFF</option>
              <option value="CONTRACTOR">CONTRACTOR</option>
              <option value="VENDOR">VENDOR</option>
              <option value="SECURITY">SECURITY</option>
            </select>
            <input
              value={internalForm.purpose}
              onChange={(e) => setInternalForm((p) => ({ ...p, purpose: e.target.value }))}
              placeholder="Purpose"
              required
            />
            <input
              type="datetime-local"
              value={internalForm.expiresAt}
              onChange={(e) => setInternalForm((p) => ({ ...p, expiresAt: e.target.value }))}
              required
            />
            <button className="btn-primary" type="submit" disabled={busy || !selectedStaff}>Grant Access</button>
          </form>
          {msg ? <p className="muted">{msg}</p> : null}
        </div>
        <div className="card doctor-alerts-card">
          <h3>Overstays</h3>
          <div className="alert-stack">
            {(overstays || []).slice(0, 8).map((row) => (
              <div key={row._id} className="alert-item">
                {row.personRef?.fullName || row.personRef?.name || "Unknown"} - expired{" "}
                {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : ""}
              </div>
            ))}
            {!overstays?.length ? <div className="alert-item">No overstay cases</div> : null}
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Latest Security Alerts</h3>
          <div className="alert-stack">
            {(alerts || []).slice(0, 10).map((a) => (
              <div key={a._id} className="alert-item">
                <strong>{a.action}</strong> - {new Date(a.createdAt).toLocaleString()}
              </div>
            ))}
            {!alerts?.length ? <div className="alert-item">No alerts</div> : null}
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Latest Access Logs</h3>
          <div className="alert-stack">
            {(logs || []).slice(0, 10).map((row) => (
              <div key={row._id} className="alert-item">
                <strong>{row.code}</strong> {row.personType} - {row.status}
              </div>
            ))}
            {!logs?.length ? <div className="alert-item">No access logs</div> : null}
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Security follow-up for transfer-related access and handover paths.</p>
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
            <button type="button" className="btn-secondary" onClick={() => window.location.assign("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => window.location.assign("/security-admin")}
            >Security Incidents</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Validate access logs for transfer-related entries.</div>
            <div className="alert-item">Review any incidents tied to transfer handover.</div>
            <div className="alert-item">Escalate suspicious access during transfer windows.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
