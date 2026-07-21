import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDoctorPatients } from "../../hooks/useDoctorPatients";

export default function MyPatients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const { filtered, encounterByPatient, resolvingEncounterId, resolveEscalation } = useDoctorPatients({ search, status, risk });

  const firstMissingRequirement = (encounter) => {
    const items = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements
      : [];
    return items[0] || "";
  };

  const closeoutLabel = (encounter) => {
    if (!encounter?._id) return "";
    if (encounter?.closeout?.canClose) return "Ready to close";
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Pending: ${missing}` : "Requirements pending";
  };
  const escalationLabel = (encounter) => {
    if (!encounter?.escalationSummary?.count || encounter?.escalationSummary?.openCount === 0) return "";
    return encounter.escalationSummary.unreadMine > 0 ? "Nurse escalation" : "Escalation open";
  };

  const handleResolveEscalation = async (encounter, patientId) => {
    const redirectPath = await resolveEscalation(encounter, patientId);
    if (redirectPath) {
      navigate(redirectPath);
    }
  };

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
                      {encounterByPatient[String(p._id)] ? (
                        <>
                          <button
                            type="button"
                            className="action-pill"
                            onClick={() =>
                              navigate(
                                `/doctor/opd?patientId=${encodeURIComponent(String(p._id))}${
                                  firstMissingRequirement(encounterByPatient[String(p._id)])
                                    ? `&focus=${encodeURIComponent(firstMissingRequirement(encounterByPatient[String(p._id)]))}`
                                    : ""
                                }`
                              )
                            }
                          >
                            {closeoutLabel(encounterByPatient[String(p._id)])}
                          </button>
                          {escalationLabel(encounterByPatient[String(p._id)]) ? (
                            <button
                              type="button"
                              className="action-pill warning"
                              onClick={() => handleResolveEscalation(encounterByPatient[String(p._id)], p._id)}
                            >
                              {resolvingEncounterId === String(encounterByPatient[String(p._id)]?._id) ? "Resolving..." : escalationLabel(encounterByPatient[String(p._id)])}
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          navigate(
                            `/doctor/opd?patientId=${encodeURIComponent(String(p._id))}${
                              firstMissingRequirement(encounterByPatient[String(p._id)])
                                ? `&focus=${encodeURIComponent(firstMissingRequirement(encounterByPatient[String(p._id)]))}`
                                : ""
                            }`
                          )
                        }
                      >
                        Start Consultation
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/medical-records?patientId=${p._id}`)}>Open Record</button>
                      <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/reports-notes?patientId=${p._id}`)}>Add Note</button>
                      <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/prescriptions?patientId=${p._id}`)}>Prescribe</button>
                      <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/referrals?patientId=${p._id}`)}>Refer</button>
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
