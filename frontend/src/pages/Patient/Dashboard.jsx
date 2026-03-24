import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPatientDashboard } from "../../services/dashboardApi";
import apiFetch from "../../utils/apiFetch";
import { listPharmacyReferrals } from "../../services/pharmacyNetworkApi";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = usePatientLanguage();
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState(null);
  const [latestVisit, setLatestVisit] = useState(null);
  const [latestEncounter, setLatestEncounter] = useState(null);
  const [latestPrescription, setLatestPrescription] = useState(null);
  const [latestReferral, setLatestReferral] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setBooting(true);

      const [
        dashboardResult,
        appointmentsResult,
        encountersResult,
        prescriptionsResult,
        referralsResult,
      ] = await Promise.allSettled([
        getPatientDashboard(),
        apiFetch("/api/appointments?limit=10"),
        apiFetch("/api/encounters?limit=1"),
        apiFetch("/api/pharmacy/prescriptions"),
        listPharmacyReferrals({ limit: 20 }),
      ]);

      if (!active) return;

      setData(dashboardResult.status === "fulfilled" ? dashboardResult.value : null);

      if (appointmentsResult.status === "fulfilled") {
        const rows = Array.isArray(appointmentsResult.value?.items)
          ? appointmentsResult.value.items
          : [];
        const latestCompleted = rows.find(
          (item) =>
            item?.metadata?.consultationSummary ||
            item?.notes ||
            item?.status === "Completed"
        );
        setLatestVisit(latestCompleted || null);
      } else {
        setLatestVisit(null);
      }

      if (encountersResult.status === "fulfilled") {
        const items = Array.isArray(encountersResult.value) ? encountersResult.value : [];
        setLatestEncounter(items[0] || null);
      } else {
        setLatestEncounter(null);
      }

      if (prescriptionsResult.status === "fulfilled") {
        const rows = Array.isArray(prescriptionsResult.value?.items)
          ? prescriptionsResult.value.items
          : [];
        setLatestPrescription(rows[0] || null);
      } else {
        setLatestPrescription(null);
      }

      if (referralsResult.status === "fulfilled") {
        const rows = Array.isArray(referralsResult.value?.items)
          ? referralsResult.value.items
          : [];
        setLatestReferral(rows[0] || null);
      } else {
        setLatestReferral(null);
      }

      setBooting(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dashboard patient-dashboard-shell">
      <div className="welcome-panel">
        <div>
          <h2>{t("dashboardTitle", "Patient Self-Service Portal")}</h2>
          <p className="muted">{t("dashboardSubtitle", "Simple patient view for appointments, results, bills, and insurance.")}</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" type="button" onClick={() => navigate("/patient/appointments")}>{t("myAppointments", "My Appointments")}</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>{t("billing", "Billing")}</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/reports")}>{t("reports", "Reports")}</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/patient/family-records")}>{t("familyRecords", "Family Records")}</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/patient/family-timeline")}>{t("familyTimeline", "Family Timeline")}</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/careers?src=PATIENT_DASHBOARD")}>{t("vacancyFeed", "Vacancy Feed")}</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/profile")}>{t("profile", "Profile")}</button>
        </div>
      </div>

      <section className="section">
        <h3>{t("topSummary", "Top Summary")}</h3>
        <div className="grid info-grid patient-dashboard-summary-grid">
          <StatCard title={t("upcomingAppointment", "Upcoming Appointment")} value={data?.upcomingAppointments ?? "—"} onClick={() => navigate("/patient/appointments")} />
          <StatCard title={t("outstandingBill", "Outstanding Bill")} value={data?.unpaidInvoices ?? "—"} onClick={() => navigate("/patient/billing")} />
          <StatCard title={t("activePrescription", "Active Prescription")} value={data?.prescriptionsActive ?? "—"} onClick={() => navigate("/patient/prescriptions")} />
          <StatCard title={t("labResults", "Lab Results")} value={data?.labResults ?? "—"} onClick={() => navigate("/patient/lab-results")} />
        </div>
      </section>

      {booting ? (
        <section className="section">
          <div className="grid info-grid patient-dashboard-loading-grid" aria-hidden="true">
            <div className="card premium-card patient-dashboard-loading-card" />
            <div className="card premium-card patient-dashboard-loading-card" />
          </div>
        </section>
      ) : null}

      {!booting && data?.familyMonitoring?.linkedMinorCount ? (
        <section className="section">
          <div className="welcome-panel">
            <div>
              <h3>Family Monitoring</h3>
              <p className="muted">
                {t(
                  "familyMonitoringSubtitle",
                  "Linked minor records are visible here so a parent or guardian can trace each child’s care from one account."
                )}
              </p>
            </div>
            <div className="welcome-actions">
              <button className="btn-primary" type="button" onClick={() => navigate("/patient/family-records")}>
                {t("openFamilyRecords", "Open Family Records")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/family-timeline")}>
                {t("openFamilyTimeline", "Open Family Timeline")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/profile")}>
                {t("manageLinkedChildren", "Manage Linked Children")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications?category=WELLNESS")}>
                {t("openDailyQuotes", "Open Daily Quotes")}
              </button>
            </div>
          </div>
          <div className="grid info-grid">
            <StatCard
              title={t("linkedChildren", "Linked Children")}
              value={data.familyMonitoring.linkedMinorCount}
              onClick={() => navigate("/patient/family-records")}
            />
            <StatCard
              title={t("upcomingChildVisits", "Upcoming Child Visits")}
              value={data.familyMonitoring.linkedMinors.reduce((sum, item) => sum + Number(item?.upcomingAppointments || 0), 0)}
              onClick={() => navigate("/patient/family-records")}
            />
            <StatCard
              title={t("trackedEncounters", "Tracked Encounters")}
              value={data.familyMonitoring.linkedMinors.reduce((sum, item) => sum + Number(item?.totalEncounters || 0), 0)}
              onClick={() => navigate("/patient/family-records")}
            />
            <StatCard
              title={t("activeChildPrescriptions", "Active Child Prescriptions")}
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
                {item.consentPolicy ? (
                  <div className="action-pill" style={{ marginTop: 8 }}>
                    {item.consentPolicy.mode === "SHARED_TEEN_ACCESS"
                      ? `Teen shared access • ${item.consentPolicy.countryCode}`
                      : `Parent proxy access • ${item.consentPolicy.countryCode}`}
                  </div>
                ) : null}
                <p className="muted">
                  Upcoming appointments: {item.upcomingAppointments} • Encounters: {item.totalEncounters} • Records: {item.medicalRecordsCount}
                </p>
                <p className="muted">
                  Latest diagnosis: {item.consentPolicy?.permissions?.detailedClinicalNotes === false
                    ? "Detailed teen clinical notes are hidden in shared-access mode"
                    : item.latestDiagnosis || "No diagnosis captured yet"}
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

      {!booting && latestPrescription ? (
        <section className="section">
          <div className="card premium-card">
            <h3>{t("latestPrescriptionStatus", "Latest Prescription Status")}</h3>
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
                {t("openPrescriptions", "Open Prescriptions")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>
                {t("openNotifications", "Open Notifications")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!booting && latestReferral ? (
        <section className="section">
          <div className="card premium-card">
            <h3>{t("latestPharmacyReferral", "Latest Pharmacy Referral")}</h3>
            <p>
              <strong>{latestReferral?.pharmacy?.name || "Pharmacy Referral"}</strong>
            </p>
            <p className="muted">Status: {latestReferral.status}</p>
            {latestReferral.reason ? <p className="muted">{latestReferral.reason}</p> : null}
            <div className="doctor-actions-row" style={{ marginTop: 10 }}>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/prescriptions")}>
                {t("openReferralProgress", "Open Referral Progress")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>
                {t("openNotifications", "Open Notifications")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>{t("healthTimeline", "Health Timeline")}</h3>
          <div className="panel-grid">
            <button className="action-link" type="button" onClick={() => navigate("/patient/medical-records")}>{t("medicalRecords", "Medical Records")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/reports")}>{t("reports", "Reports")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/prescriptions")}>{t("prescriptions", "Prescriptions")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/lab-results")}>{t("labResults", "Lab Results")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/insurance")}>{t("insurance", "Insurance")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/patient/transfers")}>{t("transferConsents", "Transfer Consents")}</button>
            <button className="action-link" type="button" onClick={() => navigate("/careers?src=PATIENT_DASHBOARD")}>{t("vacancyFeed", "Vacancy Feed")}</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{t("latestVisitSummary", "Latest Visit Summary")}</h3>
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
              <div className="muted">{t("noRecentVisitSummary", "No recent visit summary yet.")}</div>
              <button className="btn-secondary" type="button" onClick={() => navigate("/notifications")}>Messages</button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/patient/feedback")}>Feedback</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
