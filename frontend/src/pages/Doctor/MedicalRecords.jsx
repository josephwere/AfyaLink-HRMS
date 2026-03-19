import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";

export default function MedicalRecords() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setAppointments([]);
      return;
    }
    apiFetch(`/api/patients/${patientId}`)
      .then(setPatient)
      .catch(() => setPatient(null));

    apiFetch("/api/appointments?limit=50&cursorMode=1")
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        setAppointments(rows.filter((item) => String(item?.patient?._id || item?.patient) === String(patientId)));
      })
      .catch(() => setAppointments([]));
    apiFetch(`/api/encounters?patientId=${encodeURIComponent(patientId)}&limit=25`)
      .then((rows) => setEncounters(Array.isArray(rows) ? rows : []))
      .catch(() => setEncounters([]));
  }, [patientId]);

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Medical Records</h2>
          <p className="muted">Longitudinal patient history across visits, diagnostics, and attachments.</p>
        </div>
        <div className="welcome-actions">
          {patientId ? (
            <>
              <button type="button" className="btn-primary" onClick={() => navigate(`/doctor/opd?patientId=${patientId}`)}>
                Open Consultation
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/reports-notes?patientId=${patientId}`)}>
                Add Note
              </button>
            </>
          ) : null}
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Print Summary
          </button>
        </div>
      </div>

      {!patientId ? (
        <section className="section">
          <div className="card muted">Open this page from a patient record, ward board, or doctor patient list.</div>
        </section>
      ) : null}

      {patient ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <div>
                <h3>Patient Timeline</h3>
                <p className="muted">
                  {[patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
                  {patient.nationalId ? ` • ${patient.nationalId}` : ""}
                </p>
              </div>
              <div className="action-pill">Ward: {patient.ward || "OPD"}</div>
            </div>
            <div className="grid info-grid">
              <StatCard title="Status" value={patient.status || "ACTIVE"} onClick={() => navigate(`/doctor/opd?patientId=${patient._id}`)} />
              <StatCard title="Risk" value={patient.riskLevel || "MEDIUM"} onClick={() => navigate(`/doctor/lab-results?patientId=${patient._id}`)} />
              <StatCard title="Diagnosis" value={patient.primaryDiagnosis || "-"} onClick={() => navigate(`/doctor/reports-notes?patientId=${patient._id}`)} />
            </div>
          </div>
        </section>
      ) : null}

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Visit History</h3>
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Doctor</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((item) => (
                  <tr key={item._id}>
                    <td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "-"}</td>
                    <td>{item.type || item.serviceType || "Consultation"}</td>
                    <td>{item.status || "-"}</td>
                    <td>{item?.doctor?.name || item?.doctor?.email || "-"}</td>
                  </tr>
                ))}
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="muted">No visit history found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Clinical History</h3>
          <div className="alert-stack">
            {encounters.slice(0, 3).map((row) => (
              <div key={row._id} className="card">
                <strong>{row.diagnosis || "Encounter"}</strong>
                <p className="muted" style={{ marginTop: 6 }}>
                  State: {row.state || "CREATED"}
                  {row?.labSummary?.count ? ` • Labs: ${row.labSummary.count}` : " • No labs"}
                  {row?.billing?.invoiceNumber ? ` • Invoice: ${row.billing.invoiceNumber} (${row.billing.status})` : " • No billing"}
                  {row?.prescriptionSummary?.count
                    ? ` • Prescriptions: ${row.prescriptionSummary.count} (${row.prescriptionSummary.latestStatus})`
                    : " • No prescriptions"}
                </p>
                {row?.prescriptionSummary?.latestSummary ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Latest prescription: {row.prescriptionSummary.latestSummary}
                  </p>
                ) : null}
              </div>
            ))}
            {!encounters.length ? <div className="action-pill">Labs, billing, prescriptions, and notes will appear after visit closeout.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
