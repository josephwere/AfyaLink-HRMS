import React from "react";
import { useNavigate } from "react-router-dom";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";
import { usePatientMedicalRecords } from "../../hooks/usePatientMedicalRecords";

export default function PatientMedicalRecords() {
  const navigate = useNavigate();
  const { t } = usePatientLanguage();
  const { encounters, msg } = usePatientMedicalRecords();

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>{t("medicalRecordsTitle", "Medical Records")}</h2>
          <p className="muted">{t("medicalRecordsSubtitle", "Your visit history, diagnosis trail, and encounter summaries.")}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            {t("downloadRecord", "Download Record")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/family-records")}>
            {t("familyRecords", "Family Records")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/family-timeline")}>
            {t("familyTimeline", "Family Timeline")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>
            {t("reports", "Reports")}
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
              <h3>{t("encounterTimeline", "Encounter Timeline")}</h3>
              <p className="muted">{t("encounterTimelineSubtitle", "Real encounter history across active and closed visits.")}</p>
            </div>
            <div className="action-pill">{encounters.length} {t("visits", "visits")}</div>
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
            <div className="muted">{t("noEncounterHistory", "No encounter history yet.")}</div>
          )}
        </div>
      </section>
    </div>
  );
}
