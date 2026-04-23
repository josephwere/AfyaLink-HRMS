import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import {
  approveTransfer,
  completeTransfer,
  grantTransferConsent,
  getTransferAuditTrail,
  getTransferCommandCenterOverview,
  getTransferConsent,
  getTransferHandoverPackage,
  rejectTransfer,
  requestTransfer,
  revokeTransferConsent,
} from "../../services/transferApi";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { formatDateOnly } from "../../utils/locale";
import { resolveApiBase } from "../../utils/networkBase";
import { normalizeRole } from "../../utils/normalizeRole";

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "");

function scoreTone(score) {
  if (score >= 100) return "good";
  if (score >= 70) return "warn";
  return "risk";
}

const CONSENT_SCOPES = ["demographics", "encounters", "labs", "prescriptions", "reports"];
const DEFAULT_SCOPES = ["demographics", "encounters", "labs", "prescriptions"];

export default function TransferCommandCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");
  const canRequest = ["DOCTOR", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role);
  const canApprove = ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"].includes(role);
  const canConsent = ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"].includes(role);
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState({ handover: null, consent: null, audit: null });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [showHandover, setShowHandover] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [transferForm, setTransferForm] = useState({
    patientId: "",
    toHospitalId: "",
    reasons: "",
    handoverSummary: "",
    scopes: DEFAULT_SCOPES,
  });
  const [consentDraft, setConsentDraft] = useState({
    scopes: DEFAULT_SCOPES,
    expiresInDays: 30,
  });
  const queueSectionRef = useRef(null);

  const focusQueue = () => {
    queueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getTransferCommandCenterOverview({ status, limit: 50 });
      setData(res || null);
      const firstId = res?.items?.[0]?._id ? String(res.items[0]._id) : "";
      setSelectedId((current) => current || firstId);
    } catch (err) {
      setError(err?.message || "Failed to load transfer command center");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    const loadHospitals = async () => {
      try {
        const canUseAdminList = ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role);
        const endpoint = canUseAdminList ? "/api/hospitals?limit=1000" : "/api/hospitals/marketplace?limit=1000";
        const res = await apiFetch(endpoint);
        if (cancelled) return;
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setHospitals(items);
      } catch {
        if (!cancelled) setHospitals([]);
      }
    };
    loadHospitals();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    const loadPatients = async () => {
      const q = patientSearch.trim();
      const endpoint = q ? `/api/patients?q=${encodeURIComponent(q)}&limit=100` : "/api/patients?limit=100";
      try {
        const res = await apiFetch(endpoint);
        if (cancelled) return;
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setPatients(items);
      } catch {
        if (!cancelled) setPatients([]);
      }
    };
    loadPatients();
    return () => {
      cancelled = true;
    };
  }, [patientSearch]);

  useEffect(() => {
    if (!selectedId) {
      setDetail({ handover: null, consent: null, audit: null });
      return;
    }
    setShowHandover(false);
    let cancelled = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const [handover, consent, audit] = await Promise.all([
          getTransferHandoverPackage(selectedId).catch(() => null),
          getTransferConsent(selectedId).catch(() => null),
          getTransferAuditTrail(selectedId).catch(() => null),
        ]);
        if (!cancelled) {
          setDetail({ handover, consent, audit });
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!detail?.consent) return;
    const scopes = Array.isArray(detail.consent.scopes) && detail.consent.scopes.length ? detail.consent.scopes : DEFAULT_SCOPES;
    const expiresAt = detail.consent.expiresAt ? new Date(detail.consent.expiresAt) : null;
    const expiresInDays = expiresAt ? Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
    setConsentDraft({ scopes, expiresInDays });
  }, [detail?.consent?.updatedAt]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const selected = useMemo(
    () => items.find((row) => String(row._id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const openSummaryView = (kind) => {
    if (kind === "all") {
      setStatus("");
      focusQueue();
      return;
    }
    if (kind === "pending") {
      setStatus("Pending");
      focusQueue();
      return;
    }
    if (kind === "approved") {
      setStatus("Approved");
      focusQueue();
      return;
    }
    setStatus("");
    const matcher =
      kind === "consent"
        ? (row) => String(row?.consentStatus || "").toLowerCase().includes("pending")
        : kind === "overdue"
        ? (row) => Boolean(row?.overdue)
        : (row) => Number(row?.handoverCompletionScore || 0) < 70 || Number(row?.handoverMissingCount || 0) > 0;
    const match = items.find(matcher);
    if (match?._id) setSelectedId(String(match._id));
    focusQueue();
  };

  const resetActionState = () => {
    setActionMsg("");
    setActionError("");
  };

  const submitTransfer = async () => {
    resetActionState();
    if (!transferForm.patientId || !transferForm.toHospitalId) {
      setActionError("Pick a patient and destination hospital.");
      return;
    }
    setActionBusy("request");
    try {
      await requestTransfer({
        patient: transferForm.patientId,
        toHospital: transferForm.toHospitalId,
        reasons: transferForm.reasons,
        scopes: transferForm.scopes,
        metadata: transferForm.handoverSummary ? { handoverSummary: transferForm.handoverSummary } : undefined,
      });
      setActionMsg("Transfer request sent.");
      setTransferForm((prev) => ({ ...prev, reasons: "", handoverSummary: "" }));
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to request transfer.");
    } finally {
      setActionBusy("");
    }
  };

  const doApprove = async () => {
    if (!selected) return;
    resetActionState();
    setActionBusy("approve");
    try {
      await approveTransfer(selected._id);
      setActionMsg("Transfer approved.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to approve transfer.");
    } finally {
      setActionBusy("");
    }
  };

  const doReject = async () => {
    if (!selected) return;
    resetActionState();
    const reason = window.prompt("Reason for rejection (optional):", "");
    if (reason === null) return;
    setActionBusy("reject");
    try {
      await rejectTransfer(selected._id, reason || "");
      setActionMsg("Transfer rejected.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to reject transfer.");
    } finally {
      setActionBusy("");
    }
  };

  const doComplete = async ({ forceComplete = false } = {}) => {
    if (!selected) return;
    resetActionState();
    setActionBusy("complete");
    try {
      await completeTransfer(selected._id, { forceComplete });
      setActionMsg(forceComplete ? "Transfer completed with override." : "Transfer completed.");
      await load();
    } catch (err) {
      if (err?.status === 422 && !forceComplete) {
        const missing = Array.isArray(err?.data?.missing) ? err.data.missing.join(", ") : "Missing data";
        const ok = window.confirm(`Handover is incomplete: ${missing}. Complete with override?`);
        if (ok) return doComplete({ forceComplete: true });
      }
      setActionError(err?.message || "Failed to complete transfer.");
    } finally {
      setActionBusy("");
    }
  };

  const doGrantConsent = async () => {
    if (!selected) return;
    resetActionState();
    setActionBusy("consent");
    try {
      const expiresIn = Number(consentDraft.expiresInDays || 0);
      const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString() : undefined;
      await grantTransferConsent(selected._id, {
        scopes: consentDraft.scopes,
        expiresAt,
      });
      setActionMsg("Consent granted.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to grant consent.");
    } finally {
      setActionBusy("");
    }
  };

  const doRevokeConsent = async () => {
    if (!selected) return;
    resetActionState();
    setActionBusy("consent");
    try {
      await revokeTransferConsent(selected._id);
      setActionMsg("Consent revoked.");
      await load();
    } catch (err) {
      setActionError(err?.message || "Failed to revoke consent.");
    } finally {
      setActionBusy("");
    }
  };

  const toggleScope = (scope, updater, value) => {
    updater((prev) => {
      const set = new Set(prev.scopes || []);
      if (value) set.add(scope);
      else set.delete(scope);
      return { ...prev, scopes: Array.from(set) };
    });
  };

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
                  onClick={() => window.open(`${API_BASE}/api/transfers/${selected._id}/fhir`, "_blank")}
                >
                  Open FHIR Bundle
                </button>
                {" "}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.open(`${API_BASE}/api/transfers/${selected._id}/hl7`, "_blank")}
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
