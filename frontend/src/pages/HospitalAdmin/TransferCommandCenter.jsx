import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { formatDateOnly } from "../../utils/locale";
import useTransferCommandCenter from "../../hooks/useTransferCommandCenter";

function scoreTone(score) {
  if (score >= 100) return "good";
  if (score >= 70) return "warn";
  return "risk";
}

const CONSENT_SCOPES = ["demographics", "encounters", "labs", "prescriptions", "reports"];
const DEFAULT_SCOPES = ["demographics", "encounters", "labs", "prescriptions"];

export default function TransferCommandCenter() {
  const navigate = useNavigate();
  const {
    canRequest,
    canApprove,
    canConsent,
    status,
    setStatus,
    data,
    selectedId,
    setSelectedId,
    detail,
    loading,
    detailLoading,
    error,
    actionMsg,
    actionError,
    actionBusy,
    showHandover,
    setShowHandover,
    hospitals,
    patients,
    patientSearch,
    setPatientSearch,
    transferForm,
    setTransferForm,
    consentDraft,
    setConsentDraft,
    queueSectionRef,
    load,
    openSummaryView,
    submitTransfer,
    doApprove,
    doReject,
    doComplete,
    doGrantConsent,
    doRevokeConsent,
    toggleScope,
    selected,
    items,
    downloadTransferFhirBundle,
    downloadTransferHl7Export,
  } = useTransferCommandCenter();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Transfer Command Center</h2>
          <p className="muted">Cross-hospital continuity view for consent, handover completeness, and transfer risk.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/staff-transfers")}>
            Staff Transfers
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/appointments")}>
            Appointment Ops
          </button>
          <button type="button" className="btn-primary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="card">{error}</div> : null}
      {actionError ? <div className="card">{actionError}</div> : null}
      {actionMsg ? <div className="card">{actionMsg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Transfers" value={data?.summary?.total ?? 0} onClick={() => openSummaryView("all")} />
          <StatCard title="Pending" value={data?.summary?.pending ?? 0} onClick={() => openSummaryView("pending")} />
          <StatCard title="Approved" value={data?.summary?.approved ?? 0} onClick={() => openSummaryView("approved")} />
          <StatCard title="Consent Pending" value={data?.summary?.consentPending ?? 0} onClick={() => openSummaryView("consent")} />
          <StatCard title="Overdue" value={data?.summary?.overdue ?? 0} onClick={() => openSummaryView("overdue")} />
          <StatCard title="Low Continuity" value={data?.summary?.lowContinuity ?? 0} onClick={() => openSummaryView("continuity")} />
        </div>
      </section>

      {canRequest ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <h3>Request Transfer</h3>
              <span className="muted">Send a transfer request with consent scope and a brief handover note.</span>
            </div>
            <div className="form-row">
              <div>
                <label className="input-label">Patient</label>
                <input
                  className="search-input"
                  placeholder="Search patient name or ID"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  data-ai-label="Transfer Patient Search"
                  data-ai-aliases="patient lookup|search patient|find patient for transfer"
                  data-ai-intent="lookup"
                />
                <select
                  value={transferForm.patientId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, patientId: e.target.value }))}
                  data-ai-label="Transfer Patient"
                  data-ai-aliases="selected patient|patient for transfer|transfer patient"
                  data-ai-widget="patient-picker"
                >
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {[p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown"} • {p.nationalId || p._id?.slice(-6)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Destination hospital</label>
                <select
                  value={transferForm.toHospitalId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, toHospitalId: e.target.value }))}
                  data-ai-label="Destination Hospital"
                  data-ai-aliases="receiving hospital|transfer destination|destination facility"
                  data-ai-widget="hospital-picker"
                >
                  <option value="">Select hospital</option>
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name || h.code || "Hospital"} {h.city ? `• ${h.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="input-label">Reason for transfer</label>
                <textarea
                  rows={3}
                  value={transferForm.reasons}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, reasons: e.target.value }))}
                  placeholder="Short reason or clinical context"
                  data-ai-label="Reason for Transfer"
                  data-ai-aliases="transfer reason|clinical reason|handover reason"
                />
              </div>
              <div>
                <label className="input-label">Handover summary</label>
                <textarea
                  rows={3}
                  value={transferForm.handoverSummary}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, handoverSummary: e.target.value }))}
                  placeholder="Key notes for receiving team"
                  data-ai-label="Handover Summary"
                  data-ai-aliases="transfer summary|receiving team notes|handover notes"
                />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="input-label">Consent scopes</label>
                <div className="pill-row">
                  {CONSENT_SCOPES.map((scope) => (
                    <label key={scope} className="pill-chip">
                      <input
                        type="checkbox"
                        checked={transferForm.scopes.includes(scope)}
                        onChange={(e) => toggleScope(scope, setTransferForm, e.target.checked)}
                      />
                      <span>{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={submitTransfer}
                  disabled={actionBusy === "request"}
                >
                  {actionBusy === "request" ? "Sending..." : "Send Transfer Request"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section doctor-main-grid" ref={queueSectionRef}>
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <h3>Transfer Queue</h3>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Consent</th>
                  <th>Handover</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => setSelectedId(String(row._id))}
                    style={{ cursor: "pointer", background: String(row._id) === String(selectedId) ? "rgba(86, 131, 255, 0.10)" : "" }}
                  >
                    <td>
                      <strong>{row.patientName}</strong>
                      <div className="muted">{row.patientIdentifier || "No patient ID"}</div>
                    </td>
                    <td>
                      <div>{row.fromHospitalName}</div>
                      <div className="muted">to {row.toHospitalName}</div>
                    </td>
                    <td>{row.status}</td>
                    <td>{row.consentStatus}</td>
                    <td>
                      <span className={`status-chip status-${scoreTone(row.handoverCompletionScore)}`}>
                        {row.handoverCompletionScore || 0}%
                      </span>
                      <div className="muted">{row.handoverMissingCount} missing</div>
                    </td>
                    <td>
                      {row.ageHours}h
                      {row.overdue ? <div className="muted">Overdue</div> : null}
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={6}>No transfers found</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Continuity Detail</h3>
          {detailLoading ? <p className="muted">Loading transfer detail...</p> : null}
          {!selected ? <p className="muted">Pick a transfer to inspect continuity detail.</p> : null}
          {selected ? (
            <div className="alert-stack">
              <div className="alert-item">
                <strong>{selected.patientName}</strong>
                <div className="muted">{selected.reasons || "No transfer reason supplied."}</div>
              </div>
              <div className="alert-item">
                Consent: {detail?.consent?.status || selected.consentStatus}
                <div className="muted">
                  {(detail?.consent?.scopes || selected.consentScopes || []).length
                    ? (detail?.consent?.scopes || selected.consentScopes).join(", ")
                    : "No consent scopes"}
                </div>
                {detail?.consent?.expiresAt ? (
                  <div className="muted">Expires {formatDateOnly(detail.consent.expiresAt)}</div>
                ) : null}
              </div>
              <div className="alert-item">
                Handover completion: {detail?.handover?.completionScore ?? selected.handoverCompletionScore ?? 0}%
                <div className="muted">
                  {Array.isArray(detail?.handover?.missing) && detail.handover.missing.length
                    ? `Missing: ${detail.handover.missing.join(", ")}`
                    : "No missing continuity fields."}
                </div>
              </div>
              <div className="alert-item">
                Audit trail entries: {Array.isArray(detail?.audit?.logs) ? detail.audit.logs.length : 0}
              </div>
              <div className="alert-item">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowHandover((s) => !s)}
                >
                  {showHandover ? "Hide Handover Packet" : "View Handover Packet"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadTransferFhirBundle(selected._id, { openInNewTab: true })}
                >
                  Open FHIR Bundle
                </button>
                {" "}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadTransferHl7Export(selected._id, { openInNewTab: true })}
                >
                  Open HL7 Export
                </button>
              </div>
              {showHandover && detail?.handover ? (
                <div className="alert-item">
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(detail.handover, null, 2))}
                    >
                      Copy Handover JSON
                    </button>
                  </div>
                  <pre style={{ maxHeight: 240, overflow: "auto", background: "rgba(0,0,0,0.04)", padding: 12 }}>
{JSON.stringify(detail.handover, null, 2)}
                  </pre>
                </div>
              ) : null}
              {canConsent ? (
                <div className="alert-item">
                  <div className="muted">Consent controls</div>
                  <div className="pill-row">
                    {CONSENT_SCOPES.map((scope) => (
                      <label key={scope} className="pill-chip">
                        <input
                          type="checkbox"
                          checked={consentDraft.scopes.includes(scope)}
                          onChange={(e) => toggleScope(scope, setConsentDraft, e.target.checked)}
                        />
                        <span>{scope}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form-row">
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
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={doGrantConsent}
                        disabled={actionBusy === "consent"}
                      >
                        Grant Consent
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={doRevokeConsent}
                        disabled={actionBusy === "consent"}
                      >
                        Revoke Consent
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {canApprove ? (
                <div className="alert-item">
                  <div className="muted">Transfer actions</div>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={doApprove}
                      disabled={actionBusy === "approve" || selected.status !== "Pending"}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={doReject}
                      disabled={actionBusy === "reject" || selected.status !== "Pending"}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => doComplete()}
                      disabled={actionBusy === "complete" || selected.status !== "Approved"}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
