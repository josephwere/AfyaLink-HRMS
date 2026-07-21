import React from "react";
import { usePatientTransfers } from "../../hooks/usePatientTransfers";

export default function Transfers() {
  const {
    rows,
    status,
    setStatus,
    loading,
    msg,
    error,
    selectedId,
    setSelectedId,
    consentDraft,
    setConsentDraft,
    busy,
    selected,
    CONSENT_SCOPES,
    load,
    toggleScope,
    grantConsent,
    revokeConsent,
  } = usePatientTransfers();

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
