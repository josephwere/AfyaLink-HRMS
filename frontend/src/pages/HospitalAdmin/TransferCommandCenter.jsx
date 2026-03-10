import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import {
  getTransferAuditTrail,
  getTransferCommandCenterOverview,
  getTransferConsent,
  getTransferHandoverPackage,
} from "../../services/transferApi";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (envBase) return String(envBase).replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "http://localhost:5000";
}

function scoreTone(score) {
  if (score >= 100) return "good";
  if (score >= 70) return "warn";
  return "risk";
}

export default function TransferCommandCenter() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState({ handover: null, consent: null, audit: null });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (!selectedId) {
      setDetail({ handover: null, consent: null, audit: null });
      return;
    }
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

  const items = Array.isArray(data?.items) ? data.items : [];
  const selected = useMemo(
    () => items.find((row) => String(row._id) === String(selectedId)) || null,
    [items, selectedId]
  );

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

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Transfers" value={data?.summary?.total ?? 0} />
          <StatCard title="Pending" value={data?.summary?.pending ?? 0} />
          <StatCard title="Approved" value={data?.summary?.approved ?? 0} />
          <StatCard title="Consent Pending" value={data?.summary?.consentPending ?? 0} />
          <StatCard title="Overdue" value={data?.summary?.overdue ?? 0} />
          <StatCard title="Low Continuity" value={data?.summary?.lowContinuity ?? 0} />
        </div>
      </section>

      <section className="section doctor-main-grid">
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
                  onClick={() => window.open(`${getApiBase()}/api/transfers/${selected._id}/fhir`, "_blank")}
                >
                  Open FHIR Bundle
                </button>
                {" "}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.open(`${getApiBase()}/api/transfers/${selected._id}/hl7`, "_blank")}
                >
                  Open HL7 Export
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
