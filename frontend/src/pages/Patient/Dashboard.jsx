import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPatientDashboard } from "../../services/dashboardApi";
import apiFetch from "../../utils/apiFetch";
import { listPharmacyReferrals } from "../../services/pharmacyNetworkApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [latestVisit, setLatestVisit] = useState(null);
  const [latestEncounter, setLatestEncounter] = useState(null);
  const [latestPrescription, setLatestPrescription] = useState(null);
  const [latestReferral, setLatestReferral] = useState(null);

  useEffect(() => {
    getPatientDashboard().then(setData).catch(() => setData(null));
    apiFetch("/api/appointments?limit=10")
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        const latestCompleted = rows.find(
          (item) => item?.metadata?.consultationSummary || item?.notes || item?.status === "Completed"
        );
        setLatestVisit(latestCompleted || null);
      })
      .catch(() => setLatestVisit(null));
    apiFetch("/api/encounters?limit=1")
      .then((rows) => {
        const items = Array.isArray(rows) ? rows : [];
        setLatestEncounter(items[0] || null);
      })
      .catch(() => setLatestEncounter(null));
    apiFetch("/api/pharmacy/prescriptions")
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        setLatestPrescription(rows[0] || null);
      })
      .catch(() => setLatestPrescription(null));
    listPharmacyReferrals({ limit: 20 })
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        setLatestReferral(rows[0] || null);
      })
      .catch(() => setLatestReferral(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Patient Self-Service Portal</h2>
          <p className="muted">Simple patient view for appointments, results, bills, and insurance.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" type="button" onClick={() => navigate("/patient/appointments")}>My Appointments</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>Billing</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/careers?src=PATIENT_DASHBOARD")}>Vacancy Feed</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/profile")}>Profile</button>
        </div>
      </div>

      <section className="section">
        <h3>Top Summary</h3>
        <div className="grid info-grid">
          <StatCard title="Upcoming Appointment" value={data?.upcomingAppointments ?? "—"} onClick={() => navigate("/patient/appointments")} />
          <StatCard title="Outstanding Bill" value={data?.unpaidInvoices ?? "—"} onClick={() => navigate("/patient/billing")} />
          <StatCard title="Active Prescription" value={data?.prescriptionsActive ?? "—"} onClick={() => navigate("/patient/prescriptions")} />
          <StatCard title="Lab Results" value={data?.labResults ?? "—"} onClick={() => navigate("/patient/lab-results")} />
        </div>
      </section>

      {latestPrescription ? (
        <section className="section">
          <div className="card premium-card">
            <h3>Latest Prescription Status</h3>
            <p>
              <strong>{latestPrescription.summary || latestPrescription?.appointment?.serviceType || "Prescription"}</strong>
            </p>
            <p className="muted">Status: {latestPrescription.status}</p>
            {latestPrescription.dispensedAt ? (
              <p className="muted">
                Dispensed: {new Date(latestPrescription.dispensedAt).toLocaleString()}
              </p>
            ) : null}
            <div className="doctor-actions-row" style={{ marginTop: 10 }}>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/prescriptions")}>
                Open Prescriptions
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>
                Open Notifications
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {latestReferral ? (
        <section className="section">
          <div className="card premium-card">
            <h3>Latest Pharmacy Referral</h3>
            <p>
              <strong>{latestReferral?.pharmacy?.name || "Pharmacy Referral"}</strong>
            </p>
            <p className="muted">Status: {latestReferral.status}</p>
            {latestReferral.reason ? <p className="muted">{latestReferral.reason}</p> : null}
            <div className="doctor-actions-row" style={{ marginTop: 10 }}>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/prescriptions")}>
                Open Referral Progress
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>
                Open Notifications
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Health Timeline</h3>
          <div className="panel-grid">
            <button className="action-link" type="button" onClick={() => navigate("/patient/medical-records")}>Medical Records</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/prescriptions")}>Prescriptions</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/lab-results")}>Lab Results</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/insurance")}>Insurance</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/transfers")}>Transfer Consents</button>
            <button className="action-link" type="button" onClick={() => navigate("/careers?src=PATIENT_DASHBOARD")}>Vacancy Feed</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Latest Visit Summary</h3>
          {latestVisit || latestEncounter ? (
            <div className="alert-stack">
              <div className="card">
                <strong>
                  {latestEncounter?.diagnosis ||
                    latestVisit?.metadata?.consultationSummary?.diagnosis ||
                    latestVisit?.serviceType ||
                    "Recent Visit"}
                </strong>
                <p className="muted" style={{ marginTop: 8 }}>
                  {latestVisit?.metadata?.consultationSummary?.carePlan ||
                    latestVisit?.notes ||
                    latestEncounter?.consultationNotes ||
                    "No detailed summary yet."}
                </p>
                <p className="muted" style={{ marginTop: 8 }}>
                  {latestEncounter?.labSummary?.count
                    ? `Labs: ${latestEncounter.labSummary.count}`
                    : "No labs"}
                  {latestEncounter?.billing?.invoiceNumber
                    ? ` • Invoice: ${latestEncounter.billing.invoiceNumber} (${latestEncounter.billing.status})`
                    : " • No billing"}
                  {latestEncounter?.prescriptionSummary?.count
                    ? ` • Prescriptions: ${latestEncounter.prescriptionSummary.count} (${latestEncounter.prescriptionSummary.latestStatus})`
                    : " • No prescriptions"}
                </p>
                {latestVisit?.metadata?.consultationSummary?.followUpDate ? (
                  <div className="action-pill">
                    Follow-up: {new Date(latestVisit.metadata.consultationSummary.followUpDate).toLocaleDateString()}
                  </div>
                ) : latestEncounter?.closedAt ? (
                  <div className="action-pill">
                    Closed: {new Date(latestEncounter.closedAt).toLocaleDateString()}
                  </div>
                ) : null}
                <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                  <button className="btn-secondary" type="button" onClick={() => navigate("/patient/appointments")}>
                    Open Appointments
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => navigate("/patient/prescriptions")}>
                    Prescriptions
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => navigate("/patient/medical-records")}>
                    Medical Records
                  </button>
                </div>
              </div>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>Messages</button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/feedback")}>Feedback</button>
            </div>
          ) : (
            <div className="alert-stack">
              <div className="muted">No recent visit summary yet.</div>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>Messages</button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/feedback")}>Feedback</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
