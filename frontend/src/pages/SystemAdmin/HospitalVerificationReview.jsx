import React from "react";
import { useHospitalVerificationReview } from "../../hooks/useHospitalVerificationReview";

export default function HospitalVerificationReview() {
  const { queue, loading, msg, notes, setNotes, load, decide, openDocument } = useHospitalVerificationReview();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Verification Review</h2>
          <p className="muted">Review flagged hospital registrations. Parent hospitals can be approved or rejected here. Branches stay linked under the verified parent.</p>
        </div>
      </div>
      {msg ? <div className="card">{msg}</div> : null}
      <section className="section">
        <h3>Hospitals Awaiting Review</h3>
        <div className="card">
          {loading ? (
            <p>Loading review queue...</p>
          ) : queue.hospitals.length === 0 ? (
            <p>No hospitals are waiting for manual review.</p>
          ) : (
            queue.hospitals.map((row) => (
              <div key={row._id} className="card" style={{ marginBottom: 12 }}>
                <h4>{row.name}</h4>
                <p className="muted">
                  Registration: {row?.verification?.registrationNumber || "-"} •
                  Status: {row?.verification?.status || "REVIEW_REQUIRED"} •
                  Signals: {(row?.verification?.suspiciousSignals || []).join(", ") || "none"}
                </p>
                <div className="action-list">
                  {["registrationCertificate", "taxRegistration", "proofOfAddress", "representativeId"].map((docKey) => (
                    row?.verificationDocuments?.[docKey]?.storagePath ? (
                      <button
                        key={docKey}
                        className="btn-secondary"
                        type="button"
                        onClick={() => downloadHospitalVerificationDocument(row._id, docKey)}
                      >
                        Open {docKey}
                      </button>
                    ) : null
                  ))}
                </div>
                <textarea
                  rows={3}
                  placeholder="Review notes"
                  value={notes[row._id] || ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [row._id]: e.target.value }))}
                />
                <div className="action-list">
                  <button type="button" className="btn-primary" onClick={() => decide(row._id, "APPROVE")}>Approve</button>
                  <button type="button" className="btn-secondary" onClick={() => decide(row._id, "REJECT")}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="section">
        <h3>Branches Waiting Review</h3>
        <div className="card">
          {queue.branches.length === 0 ? (
            <p>No branches are waiting for manual review.</p>
          ) : (
            <table className="table lite">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Parent Hospital</th>
                  <th>Registration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.branches.map((row) => (
                  <tr key={row._id}>
                    <td>{row.name}</td>
                    <td>{row.parentHospitalName || "-"}</td>
                    <td>{row?.verification?.registrationNumber || "-"}</td>
                    <td>{row?.verification?.status || "REVIEW_REQUIRED"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
