import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

export default function PatientMedicalRecords() {
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("/api/encounters?limit=25")
      .then((rows) => setEncounters(Array.isArray(rows) ? rows : []))
      .catch((e) => {
        setEncounters([]);
        setMsg(e?.message || "Failed to load medical record timeline.");
      });
  }, []);

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Medical Records</h2>
          <p className="muted">Your visit history, diagnosis trail, and encounter summaries.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Download Record
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>
            Open Reports
          </button>
        </div>
      </div>

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Encounter Timeline</h3>
              <p className="muted">Real encounter history across active and closed visits.</p>
            </div>
            <div className="action-pill">{encounters.length} visits</div>
          </div>

          {encounters.length ? (
            <div className="alert-stack">
              {encounters.map((row) => (
                <div key={row._id} className="card">
                  <div className="card-header-actions">
                    <div>
                      <strong>{row.diagnosis || "Visit Record"}</strong>
                      <p className="muted">
                        State: {row.state || "CREATED"}
                        {row?.doctor?.name ? ` • Doctor: ${row.doctor.name}` : ""}
                      </p>
                    </div>
                    <div className="action-pill">
                      {row.closedAt ? new Date(row.closedAt).toLocaleDateString() : "Open"}
                    </div>
                  </div>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {row?.labSummary?.count ? `Labs: ${row.labSummary.count}` : "No labs"}
                    {row?.billing?.invoiceNumber ? ` • Invoice: ${row.billing.invoiceNumber} (${row.billing.status})` : " • No billing"}
                    {row?.prescriptionSummary?.count
                      ? ` • Prescriptions: ${row.prescriptionSummary.count} (${row.prescriptionSummary.latestStatus})`
                      : " • No prescriptions"}
                  </p>
                  {row?.prescriptionSummary?.latestSummary ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      Latest prescription: {row.prescriptionSummary.latestSummary}
                    </p>
                  ) : null}
                  <p className="muted" style={{ marginTop: 8 }}>
                    {row.consultationNotes || "No consultation notes captured for this visit yet."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No encounter history yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
