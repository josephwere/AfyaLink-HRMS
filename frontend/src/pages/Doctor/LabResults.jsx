import React from "react";
import { useNavigate } from "react-router-dom";
import { useDoctorLabResults } from "../../hooks/useDoctorLabResults";

export default function LabResults() {
  const navigate = useNavigate();
  const { rows } = useDoctorLabResults();

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Lab Results</h2>
          <p className="muted">Pending, completed and abnormal results with signature workflow.</p>
        </div>
      </div>
      <section className="section">
        <h3>Result Queue</h3>
        <div className="table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>Encounter</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{r.encounter || "-"}</td>
                  <td>{r.status || "-"}</td>
                  <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate(`/doctor/medical-records?encounterId=${encodeURIComponent(r.encounter || "")}`)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="4" className="muted">No lab results found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
