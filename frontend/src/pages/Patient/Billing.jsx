import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { listMyReports } from "../../services/reportsApi";
import { StatCard } from "../../components/Cards";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";

export default function PatientBilling() {
  const navigate = useNavigate();
  const { t } = usePatientLanguage();
  const [encounters, setEncounters] = useState([]);
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/encounters?limit=50"),
      listMyReports({ cursorMode: true, limit: 10 }),
    ])
      .then(([encounterRows, reportRows]) => {
        setEncounters(Array.isArray(encounterRows) ? encounterRows : []);
        setReports(Array.isArray(reportRows?.items) ? reportRows.items : Array.isArray(reportRows) ? reportRows : []);
      })
      .catch((err) => {
        setEncounters([]);
        setReports([]);
        setMsg(err?.message || "Failed to load billing and linked report data.");
      });
  }, []);

  const invoiceRows = useMemo(
    () => encounters.filter((row) => row?.billing?.invoiceNumber),
    [encounters]
  );

  const outstandingInvoices = invoiceRows.filter(
    (row) => String(row?.billing?.status || "").toUpperCase() !== "PAID"
  );

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>{t("billingDocumentsTitle", "Billing & Care Documents")}</h2>
          <p className="muted">
            {t(
              "billingDocumentsSubtitle",
              "View invoice summaries and clinical reports from your own profile and any linked minors you monitor."
            )}
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/payments")}>
            {t("openPayments", "Open Payments")}
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
          <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>
            {t("manageLinkedChildren", "Manage Linked Children")}
          </button>
        </div>
      </div>

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Invoices in Timeline" value={invoiceRows.length} onClick={() => window.scrollTo({ top: 520, behavior: "smooth" })} />
          <StatCard title="Outstanding" value={outstandingInvoices.length} onClick={() => window.scrollTo({ top: 520, behavior: "smooth" })} />
          <StatCard title="Care Reports" value={reports.length} onClick={() => window.scrollTo({ top: 980, behavior: "smooth" })} />
          <StatCard title="Encounter Timeline" value={encounters.length} onClick={() => navigate("/patient/medical-records")} />
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>{t("invoiceSummary", "Invoice Summary")}</h3>
              <p className="muted">
                {t(
                  "encounterInvoiceTrail",
                  "Encounter-linked invoice trail for your profile and any linked child records."
                )}
              </p>
            </div>
            <div className="action-pill">{outstandingInvoices.length} outstanding</div>
          </div>

          {invoiceRows.length ? (
            <div className="alert-stack" style={{ marginTop: 12 }}>
              {invoiceRows.map((row) => (
                <div key={row._id} className="card">
                  <strong>{row.diagnosis || row?.appointment?.serviceType || "Encounter invoice"}</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Invoice: {row.billing.invoiceNumber} • Status: {row.billing.status || "Unpaid"}
                  </p>
                  <p className="muted">
                    Encounter date: {row.closedAt ? new Date(row.closedAt).toLocaleDateString() : new Date(row.createdAt).toLocaleDateString()}
                  </p>
                  <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn-secondary" onClick={() => navigate("/payments")}>
                      {t("payCheckout", "Pay / Checkout")}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate("/patient/medical-records")}>
                      {t("openEncounter", "Open Encounter")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              No encounter-linked invoices found yet.
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>{t("clinicalReports", "Clinical Reports")}</h3>
              <p className="muted">
                {t(
                  "clinicalReportsSubtitle",
                  "Medical and continuity reports available to your account, including linked minors."
                )}
              </p>
            </div>
            <div className="action-pill">{reports.length} reports</div>
          </div>

          {reports.length ? (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="doctor-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Patient</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((row) => (
                    <tr key={row._id}>
                      <td>{row.title || "Clinical Report"}</td>
                      <td>
                        {row?.patient?.firstName
                          ? `${row.patient.firstName} ${row.patient.lastName || ""}`.trim()
                          : row?.patient?.name || "Patient"}
                      </td>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              {t("noReportsYet", "No reports available yet.")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
