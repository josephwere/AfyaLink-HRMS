import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function AssignedPatients() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    apiFetch("/api/patients?limit=50")
      .then((res) => setRows(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel"><div><h2>Assigned Patients</h2><p className="muted">Patient list with quick actions for bedside workflow.</p></div></div>
      <section className="section">
        <div className="table-wrap">
          <table className="doctor-table">
            <thead><tr><th>Name</th><th>Ward</th><th>Status</th><th>Risk</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id}>
                  <td>{[p.firstName, p.lastName].filter(Boolean).join(" ") || "-"}</td>
                  <td>{p.ward || "-"}</td>
                  <td>{p.status || "ACTIVE"}</td>
                  <td>{p.riskLevel || "MEDIUM"}</td>
                  <td><button className="btn-secondary">Open</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="5" className="muted">No assigned patients found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
