import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDoctorTransfers } from "../../hooks/useDoctorTransfers";
import { formatDateOnly } from "../../utils/locale";

export default function Transfers() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const { rows, selectedId, setSelectedId, detail, loading, detailLoading, error, selected, load, downloadTransferBundle } = useDoctorTransfers(status);

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
                    <td>{row.createdAt ? formatDateOnly(row.createdAt) : "—"}</td>
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
                  onClick={() =>
                    downloadTransferBundle(selected._id, "fhir")
                  }
                >
                  Open FHIR Bundle
                </button>
                {" "}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    downloadTransferBundle(selected._id, "hl7")
                  }
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
