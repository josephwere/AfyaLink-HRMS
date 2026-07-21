import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useNursePatientFlow } from "../../hooks/useNursePatientFlow";

export default function AssignedPatients() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPatientId = searchParams.get("patientId") || "";
  const { rows, selectedPatient, encounterByPatient, msg, escalatingPatientId, escalateEncounter } = useNursePatientFlow(selectedPatientId);

  const orderedRows = useMemo(() => {
    if (!selectedPatientId) return rows;
    return [...rows].sort((a, b) => {
      const aMatch = String(a._id) === String(selectedPatientId) ? 1 : 0;
      const bMatch = String(b._id) === String(selectedPatientId) ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [rows, selectedPatientId]);

  const nurseReadinessLabel = (encounter) => {
    if (!encounter?._id) return "No active visit";
    if (encounter?.closeout?.canClose) return "Transfer/Discharge Ready";
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Hold: ${missing}` : "Review clinician handoffs";
  };

  const escalationLabel = (encounter) => {
    const summary = encounter?.escalationSummary;
    if (!summary?.count) return "";
    if (summary.openCount > 0) return "Escalated • Awaiting response";
    return "Escalation resolved";
  };

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Assigned Patients</h2>
          <p className="muted">Patient list with quick actions for bedside workflow.</p>
        </div>
      </div>

      {selectedPatient ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <div>
                <h3>Selected Patient</h3>
                <p className="muted">
                  {[selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
                  {selectedPatient.nationalId ? ` • ${selectedPatient.nationalId}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div className="action-pill">
                  {nurseReadinessLabel(encounterByPatient[String(selectedPatient._id)])}
                </div>
                {escalationLabel(encounterByPatient[String(selectedPatient._id)]) ? (
                  <div className="action-pill warning">{escalationLabel(encounterByPatient[String(selectedPatient._id)])}</div>
                ) : null}
                {encounterByPatient[String(selectedPatient._id)]?.escalationSummary?.openCount === 0 &&
                encounterByPatient[String(selectedPatient._id)]?.escalationSummary?.resolvedAt ? (
                  <div className="muted">
                    Resolved by{" "}
                    {encounterByPatient[String(selectedPatient._id)]?.escalationSummary?.resolvedBy?.name || "clinician"}
                  </div>
                ) : null}
                {encounterByPatient[String(selectedPatient._id)]?.closeout?.canClose === false ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate(`/nurse/vitals?patientId=${selectedPatient._id}`)}
                    >
                      Review Handoffs
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => escalateEncounter(encounterByPatient[String(selectedPatient._id)])}
                      disabled={escalatingPatientId === String(selectedPatient._id)}
                    >
                      {escalatingPatientId === String(selectedPatient._id) ? "Escalating..." : "Escalate"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate(`/nurse/vitals?patientId=${selectedPatient._id}`)}
                >
                  Record Vitals
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate(`/nurse/medication?patientId=${selectedPatient._id}`)}
                >
                  Medication
                </button>
              </div>
            </div>
            <div className="grid info-grid">
              <StatCard
                title="Ward"
                value={selectedPatient.ward || "-"}
                onClick={() => navigate(`/nurse/ward-board?patientId=${selectedPatient._id}`)}
              />
              <StatCard
                title="Status"
                value={selectedPatient.status || "ACTIVE"}
                onClick={() => navigate(`/nurse/patients?patientId=${selectedPatient._id}`)}
              />
              <StatCard
                title="Risk"
                value={selectedPatient.riskLevel || "MEDIUM"}
                onClick={() => navigate(`/nurse/vitals?patientId=${selectedPatient._id}`)}
              />
            </div>
          </div>
        </section>
      ) : null}

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="table-wrap">
          <table className="doctor-table">
            <thead><tr><th>Name</th><th>Ward</th><th>Status</th><th>Risk</th><th>Action</th></tr></thead>
            <tbody>
              {orderedRows.map((p) => {
                const isSelected = String(p._id) === String(selectedPatientId);
                return (
                  <tr key={p._id} style={isSelected ? { background: "rgba(14, 165, 233, 0.08)" } : undefined}>
                    <td>{[p.firstName, p.lastName].filter(Boolean).join(" ") || "-"}</td>
                    <td>{p.ward || "-"}</td>
                    <td>{p.status || "ACTIVE"}</td>
                    <td>{p.riskLevel || "MEDIUM"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {encounterByPatient[String(p._id)] ? (
                          <>
                            <button
                              type="button"
                              className="action-pill"
                              onClick={() => navigate(`/nurse/vitals?patientId=${p._id}`)}
                            >
                              {nurseReadinessLabel(encounterByPatient[String(p._id)])}
                            </button>
                            {escalationLabel(encounterByPatient[String(p._id)]) ? (
                              <div className="action-pill warning">{escalationLabel(encounterByPatient[String(p._id)])}</div>
                            ) : null}
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(`/nurse/patients?patientId=${p._id}`)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(`/nurse/vitals?patientId=${p._id}`)}
                        >
                          Vitals
                        </button>
                        {encounterByPatient[String(p._id)]?.closeout?.canClose === false ? (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => navigate(`/nurse/vitals?patientId=${p._id}`)}
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => escalateEncounter(encounterByPatient[String(p._id)])}
                              disabled={escalatingPatientId === String(p._id)}
                            >
                              {escalatingPatientId === String(p._id) ? "Escalating..." : "Escalate"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orderedRows.length === 0 && <tr><td colSpan="5" className="muted">No assigned patients found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
