import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTransferConsent, getTransferHandoverPackage, listTransfers } from "../../services/transferApi";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (envBase) return String(envBase).replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "http://localhost:5000";
}

export default function Transfers() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState({ consent: null, handover: null });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listTransfers({ status, limit: 50, scope: "mine" });
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

  useEffect(() => {
    if (!selectedId) {
      setDetail({ consent: null, handover: null });
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const [consent, handover] = await Promise.all([
          getTransferConsent(selectedId).catch(() => null),
          getTransferHandoverPackage(selectedId).catch(() => null),
        ]);
        if (!cancelled) setDetail({ consent, handover });
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => rows.find((row) => String(row._id) === String(selectedId)) || null,
    [rows, selectedId]
  );

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Transfer Requests</h2>
          <p className="muted">Review transfer continuity and open handover packets before accepting care.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/opd")}>
            Open OPD
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
            Transfer Command Center
          </button>
          <button type="button" className="btn-primary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="card">{error}</div> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <h3>Transfer Queue</h3>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
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
                    <td>
                      <strong>{row?.patient?.firstName || ""} {row?.patient?.lastName || ""}</strong>
                      <div className="muted">{row?.patient?.nationalId || row?.patient?.countryId || "No patient ID"}</div>
                    </td>
                    <td>
                      <div>{row?.fromHospital?.name || row?.fromHospital?.code || "—"}</div>
                      <div className="muted">to {row?.toHospital?.name || row?.toHospital?.code || "—"}</div>
                    </td>
                    <td>{row.status}</td>
                    <td>{row?.consent?.status || "PENDING"}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5}>No transfers found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Transfer Detail</h3>
          {detailLoading ? <p className="muted">Loading detail...</p> : null}
          {!selected ? <p className="muted">Select a transfer to review handover details.</p> : null}
          {selected ? (
            <div className="alert-stack">
              <div className="alert-item">
                <strong>{selected?.patient?.firstName || ""} {selected?.patient?.lastName || ""}</strong>
                <div className="muted">{selected.reasons || "No transfer reason supplied."}</div>
              </div>
              <div className="alert-item">
                Consent: {detail?.consent?.status || selected?.consent?.status || "PENDING"}
                <div className="muted">
                  {(detail?.consent?.scopes || selected?.consent?.scopes || []).length
                    ? (detail?.consent?.scopes || selected?.consent?.scopes).join(", ")
                    : "No consent scopes"}
                </div>
              </div>
              {detail?.handover ? (
                <div className="alert-item">
                  Handover completion: {detail.handover.completionScore ?? 0}%
                  <div className="muted">
                    {Array.isArray(detail.handover.missing) && detail.handover.missing.length
                      ? `Missing: ${detail.handover.missing.join(", ")}`
                      : "No missing continuity fields."}
                  </div>
                </div>
              ) : null}
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
