import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

export default function MyPatients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const q = search.trim();
    const endpoint = q ? `/api/patients?q=${encodeURIComponent(q)}&limit=100` : "/api/patients?limit=100";
    apiFetch(endpoint)
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setRows(items);
      })
      .catch(() => setRows([]));
  }, [search]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const rowStatus = String(r.status || "ACTIVE").toUpperCase();
      const rowRisk = String(r.riskLevel || "MEDIUM").toUpperCase();
      const statusOk = status === "ALL" || rowStatus === status;
      const riskOk = risk === "ALL" || rowRisk === risk;
      return statusOk && riskOk;
    });
  }, [rows, risk, status]);

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>My Patients</h2>
          <p className="muted">Search and manage inpatient, outpatient and follow-up cases.</p>
        </div>
        <div className="welcome-actions">
          <input
            className="search-input"
            placeholder="Search patient name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="CRITICAL">Critical</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="ALL">All Risk</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <section className="section">
        <h3>Patient Table</h3>
        <div className="table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Diagnosis</th>
                <th>Admission Type</th>
                <th>Status</th>
                <th>Risk Level</th>
                <th>Last Visit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td>{p.nationalId || p._id?.slice(-8) || "-"}</td>
                  <td>{[p.firstName, p.lastName].filter(Boolean).join(" ") || "-"}</td>
                  <td>{p.age ?? "-"}</td>
                  <td>{p.primaryDiagnosis || "-"}</td>
                  <td>{p.admissionType || "Outpatient"}</td>
                  <td>{p.status || "ACTIVE"}</td>
                  <td>{p.riskLevel || "MEDIUM"}</td>
                  <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "-"}</td>
                  <td>
                    <div className="doctor-actions-row">
                      <button className="btn-secondary" onClick={() => navigate(`/doctor/medical-records?patientId=${p._id}`)}>Open Record</button>
                      <button className="btn-secondary" onClick={() => navigate(`/doctor/reports-notes?patientId=${p._id}`)}>Add Note</button>
                      <button className="btn-secondary" onClick={() => navigate(`/doctor/prescriptions?patientId=${p._id}`)}>Prescribe</button>
                      <button className="btn-secondary" onClick={() => navigate(`/doctor/referrals?patientId=${p._id}`)}>Refer</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="9" className="muted">No patients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
