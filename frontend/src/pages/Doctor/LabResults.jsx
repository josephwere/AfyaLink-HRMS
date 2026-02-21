import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function LabResults() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    apiFetch("/api/lab", { method: "GET" })
      .then((d) => setRows(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }, []);

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
                  <td><button className="btn-secondary">Open</button></td>
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
