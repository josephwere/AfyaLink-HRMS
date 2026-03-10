import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

export default function AssignedPatients() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPatientId = searchParams.get("patientId") || "";
  const [rows, setRows] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [msg, setMsg] = useState("");
  const [escalatingPatientId, setEscalatingPatientId] = useState("");

  useEffect(() => {
    apiFetch("/api/patients?limit=50")
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setRows(items);
        return Promise.all(
          items
            .map((item) => String(item?._id || ""))
            .filter(Boolean)
            .map(async (patientId) => {
              try {
                const encounterRows = await apiFetch(`/api/encounters?patientId=${encodeURIComponent(patientId)}&limit=1`);
                const encounterItems = Array.isArray(encounterRows) ? encounterRows : [];
                return [patientId, encounterItems[0] || null];
              } catch {
                return [patientId, null];
              }
            })
        );
      })
      .then((pairs) => {
        if (Array.isArray(pairs)) setEncounterByPatient(Object.fromEntries(pairs));
      })
      .catch(() => {
        setRows([]);
        setEncounterByPatient({});
      });
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatient(null);
      return;
    }
    apiFetch(`/api/patients/${selectedPatientId}`)
      .then(setSelectedPatient)
      .catch(() => setSelectedPatient(null));
  }, [selectedPatientId]);

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

  async function escalateEncounter(encounter) {
    if (!encounter?._id) return;
    try {
      setEscalatingPatientId(String(encounter.patient?._id || encounter.patient || ""));
      const res = await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/nurse-escalation`, {
        method: "POST",
        body: {
          note: "Ward team requested clinician review before discharge or transfer.",
        },
      });
      setMsg(`Escalation sent to ${res?.recipients || 0} recipient(s).`);
    } catch (e) {
      setMsg(e?.message || "Failed to send escalation.");
    } finally {
      setEscalatingPatientId("");
    }
  }

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
              <div className="card stat">
                <div className="card-title">Ward</div>
                <div className="card-value">{selectedPatient.ward || "-"}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Status</div>
                <div className="card-value">{selectedPatient.status || "ACTIVE"}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Risk</div>
                <div className="card-value">{selectedPatient.riskLevel || "MEDIUM"}</div>
              </div>
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
