import React, { useEffect, useMemo, useState } from "react";
import {
  listMyTransfers,
  patientGrantTransferConsent,
  patientRevokeTransferConsent,
} from "../../services/transferApi";

const CONSENT_SCOPES = ["demographics", "encounters", "labs", "prescriptions", "reports"];
const DEFAULT_SCOPES = ["demographics", "encounters", "labs", "prescriptions"];

export default function Transfers() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [consentDraft, setConsentDraft] = useState({ scopes: DEFAULT_SCOPES, expiresInDays: 30 });
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listMyTransfers({ status, limit: 50 });
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items);
      if (!selectedId && items[0]?._id) setSelectedId(String(items[0]._id));
    } catch (err) {
      setError(err?.message || "Failed to load transfers.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const selected = useMemo(
    () => rows.find((row) => String(row._id) === String(selectedId)) || null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selected?.consent) return;
    const scopes = Array.isArray(selected.consent.scopes) && selected.consent.scopes.length
      ? selected.consent.scopes
      : DEFAULT_SCOPES;
    const expiresAt = selected.consent.expiresAt ? new Date(selected.consent.expiresAt) : null;
    const expiresInDays = expiresAt ? Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
    setConsentDraft({ scopes, expiresInDays });
  }, [selected?.consent?.updatedAt]);

  const toggleScope = (scope, value) => {
    setConsentDraft((prev) => {
      const set = new Set(prev.scopes || []);
      if (value) set.add(scope);
      else set.delete(scope);
      return { ...prev, scopes: Array.from(set) };
    });
  };

  const grantConsent = async () => {
    if (!selected) return;
    setMsg("");
    setError("");
    setBusy("grant");
    try {
      const expiresIn = Number(consentDraft.expiresInDays || 0);
      const expiresAt = expiresIn > 0
        ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      await patientGrantTransferConsent(selected._id, {
        scopes: consentDraft.scopes,
        expiresAt,
      });
      setMsg("Consent granted.");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to grant consent.");
    } finally {
      setBusy("");
    }
  };

  const revokeConsent = async () => {
    if (!selected) return;
    setMsg("");
    setError("");
    setBusy("revoke");
    try {
      await patientRevokeTransferConsent(selected._id);
      setMsg("Consent revoked.");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to revoke consent.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Transfer Consents</h2>
          <p className="muted">Review transfer requests and control what data is shared with the receiving hospital.</p>
        </div>
        <div className="welcome-actions">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button className="btn-secondary" type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="card">{error}</div> : null}
      {msg ? <div className="card">{msg}</div> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <h3>Transfer Requests</h3>
            <span className="muted">Pick a transfer to review consent details.</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Consent</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => setSelectedId(String(row._id))}
                    style={{ cursor: "pointer", background: String(row._id) === String(selectedId) ? "rgba(86, 131, 255, 0.10)" : "" }}
                  >
                    <td>{row?.fromHospital?.name || row?.fromHospital?.code || "—"}</td>
                    <td>{row?.toHospital?.name || row?.toHospital?.code || "—"}</td>
                    <td>{row.status}</td>
                    <td>{row?.consent?.status || "PENDING"}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5}>No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Consent Detail</h3>
          {!selected ? <p className="muted">Select a transfer to review consent settings.</p> : null}
          {selected ? (
            <div className="alert-stack">
              <div className="alert-item">
                <strong>{selected?.fromHospital?.name || "Source Hospital"}</strong>
                <div className="muted">to {selected?.toHospital?.name || "Destination Hospital"}</div>
              </div>
              <div className="alert-item">
                Status: {selected.status}
                <div className="muted">{selected.reasons || "No transfer reason supplied."}</div>
              </div>
              <div className="alert-item">
                Consent: {selected?.consent?.status || "PENDING"}
                <div className="muted">
                  {(selected?.consent?.scopes || []).length
                    ? selected.consent.scopes.join(", ")
                    : "No consent scopes yet"}
                </div>
                {selected?.consent?.expiresAt ? (
                  <div className="muted">Expires {new Date(selected.consent.expiresAt).toLocaleDateString()}</div>
                ) : null}
              </div>
              <div className="alert-item">
                <div className="muted">Consent scopes</div>
                <div className="pill-row">
                  {CONSENT_SCOPES.map((scope) => (
                    <label key={scope} className="pill-chip">
                      <input
                        type="checkbox"
                        checked={consentDraft.scopes.includes(scope)}
                        onChange={(e) => toggleScope(scope, e.target.checked)}
                      />
                      <span>{scope}</span>
                    </label>
                  ))}
                </div>
                <div className="form-row" style={{ marginTop: 10 }}>
                  <div>
                    <label className="input-label">Expires in days</label>
                    <input
                      type="number"
                      min="1"
                      value={consentDraft.expiresInDays}
                      onChange={(e) =>
                        setConsentDraft((prev) => ({ ...prev, expiresInDays: e.target.value }))
                      }
                    />
                  </div>
                  <div className="card-actions">
                    <button className="btn-primary" type="button" onClick={grantConsent} disabled={busy === "grant"}>
                      Grant Consent
                    </button>
                    <button className="btn-secondary" type="button" onClick={revokeConsent} disabled={busy === "revoke"}>
                      Revoke Consent
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
