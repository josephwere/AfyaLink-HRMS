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
          <button className="btn-secondary" type="button" onClick={() => navigate("/reports")}>Reports</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/patient/family-records")}>Family Records</button>
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

      {data?.familyMonitoring?.linkedMinorCount ? (
        <section className="section">
          <div className="welcome-panel">
            <div>
              <h3>Family Monitoring</h3>
              <p className="muted">
                Linked minor records are visible here so a parent or guardian can trace each child’s care from one account.
              </p>
            </div>
            <div className="welcome-actions">
              <button className="btn-primary" type="button" onClick={() => navigate("/patient/family-records")}>
                Open Family Records
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/profile")}>
                Manage Linked Children
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications?category=WELLNESS")}>
                Open Daily Quotes
              </button>
            </div>
          </div>
          <div className="grid info-grid">
            <StatCard
              title="Linked Children"
              value={data.familyMonitoring.linkedMinorCount}
              onClick={() => navigate("/patient/family-records")}
            />
            <StatCard
              title="Upcoming Child Visits"
              value={data.familyMonitoring.linkedMinors.reduce((sum, item) => sum + Number(item?.upcomingAppointments || 0), 0)}
              onClick={() => navigate("/patient/family-records")}
            />
            <StatCard
              title="Tracked Encounters"
              value={data.familyMonitoring.linkedMinors.reduce((sum, item) => sum + Number(item?.totalEncounters || 0), 0)}
              onClick={() => navigate("/patient/family-records")}
            />
            <StatCard
              title="Active Child Prescriptions"
              value={data.familyMonitoring.linkedMinors.reduce((sum, item) => sum + Number(item?.activePrescriptions || 0), 0)}
              onClick={() => navigate("/patient/family-records")}
            />
          </div>
          <div className="panel-grid" style={{ marginTop: 14 }}>
            {data.familyMonitoring.linkedMinors.map((item) => (
              <div key={item.patientId} className="card premium-card">
                <h4>{item.name}</h4>
                <p className="muted">
                  {item.relationship || "Parent"} • Age {item.age ?? "—"} • {item.hospitalName || "Hospital not set"}
                </p>
                <p className="muted">
                  Upcoming appointments: {item.upcomingAppointments} • Encounters: {item.totalEncounters} • Records: {item.medicalRecordsCount}
                </p>
                <p className="muted">
                  Latest diagnosis: {item.latestDiagnosis || "No diagnosis captured yet"}
                </p>
                <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                  <button className="btn-secondary" type="button" onClick={() => navigate("/patient/family-records")}>
                    Family Records
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => navigate("/patient/medical-records")}>
                    Medical Records
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => navigate("/profile")}>
                    Manage Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
            <button className="action-link" type="button" onClick={() => navigate("/reports")}>Reports</button>
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
