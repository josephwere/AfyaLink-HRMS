import React, { useEffect, useState } from "react";
import { getHospitalVerificationReviewQueue, reviewHospitalVerification } from "../../services/systemAdminApi";

export default function HospitalVerificationReview() {
  const [queue, setQueue] = useState({ hospitals: [], branches: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState({});
  const base = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

  const load = async () => {
    setLoading(true);
    try {
      const data = await getHospitalVerificationReviewQueue();
      setQueue({
        hospitals: Array.isArray(data?.hospitals) ? data.hospitals : [],
        branches: Array.isArray(data?.branches) ? data.branches : [],
      });
    } catch {
      setQueue({ hospitals: [], branches: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id, decision) => {
    setMsg("");
    try {
      await reviewHospitalVerification(id, {
        decision,
        reviewNotes: notes[id] || "",
      });
      setMsg(`Hospital ${decision === "APPROVE" ? "approved" : "rejected"}.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to review hospital.");
    }
  };

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
                      <a
                        key={docKey}
                        className="btn-secondary"
                        href={`${base}/api/system-admin/hospital-verification/${row._id}/documents/${docKey}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open {docKey}
                      </a>
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
