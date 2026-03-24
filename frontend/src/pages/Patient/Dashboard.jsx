import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPatientDashboard } from "../../services/dashboardApi";
import apiFetch from "../../utils/apiFetch";
import { listPharmacyReferrals } from "../../services/pharmacyNetworkApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
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

  const linkedChildrenCount = Number(data?.familyMonitoring?.linkedMinorCount || 0);
  const latestPrescriptionStatus = latestPrescription?.status || t("notAvailable", "Not available");
  const latestReferralStatus = latestReferral?.status || t("notAvailable", "Not available");
  const latestVisitStatus = latestVisit || latestEncounter ? t("ready", "Ready") : t("noneYet", "None yet");

  return (
    <DashboardHomeShell
      className="patient-dashboard-shell"
      kicker="Patient workspace"
      title={t("dashboardTitle", "Patient Self-Service Portal")}
      subtitle={t("dashboardSubtitle", "Simple patient view for appointments, results, bills, and insurance.")}
      actions={[
        { label: t("myAppointments", "My Appointments"), path: "/patient/appointments" },
        { label: t("billing", "Billing"), path: "/payments", variant: "secondary" },
        { label: t("familyRecords", "Family Records"), path: "/patient/family-records", variant: "secondary" },
        { label: t("profile", "Profile"), path: "/profile", variant: "secondary" },
      ]}
      stats={[
        { label: t("upcomingAppointment", "Upcoming Appointment"), value: data?.upcomingAppointments ?? "—" },
        { label: t("outstandingBill", "Outstanding Bill"), value: data?.unpaidInvoices ?? "—" },
        { label: t("activePrescription", "Active Prescription"), value: data?.prescriptionsActive ?? "—" },
        { label: t("labResults", "Lab Results"), value: data?.labResults ?? "—" },
      ]}
      contextCards={[
        {
          title: t("accountPulse", "Account Pulse"),
          subtitle: t("quickSignalsForYourCareAndFamily", "Quick signals for your care and family tracking."),
          items: [
            { label: t("linkedChildren", "Linked Children"), value: linkedChildrenCount },
            { label: t("prescriptionStatus", "Prescription Status"), value: latestPrescriptionStatus },
            { label: t("referralStatus", "Referral Status"), value: latestReferralStatus },
          ],
          actions: [
            { label: t("openFamilyTimeline", "Open Family Timeline"), path: "/patient/family-timeline", variant: "secondary" },
            { label: t("openNotifications", "Open Notifications"), path: "/notifications", variant: "secondary" },
          ],
        },
        {
          title: t("careNext", "Care Next"),
          subtitle: t("Focus on the next step, not just the latest data.", "Focus on the next step, not just the latest data."),
          items: [
            { label: t("latestVisit", "Latest Visit"), value: latestVisitStatus },
            { label: t("messages", "Messages"), value: t("available", "Available") },
            { label: t("feedback", "Feedback"), value: t("open", "Open") },
          ],
          actions: [
            { label: t("messages", "Messages"), path: "/notifications", variant: "secondary" },
            { label: t("feedback", "Feedback"), path: "/patient/feedback", variant: "secondary" },
          ],
        },
      ]}
    >

      <DashboardSection title={t("topSummary", "Top Summary")} subtitle={t("Your key patient signals at a glance.", "Your key patient signals at a glance.")}>
        <div className="grid info-grid patient-dashboard-summary-grid">
          <StatCard title={t("upcomingAppointment", "Upcoming Appointment")} value={data?.upcomingAppointments ?? "—"} onClick={() => navigate("/patient/appointments")} />
          <StatCard title={t("outstandingBill", "Outstanding Bill")} value={data?.unpaidInvoices ?? "—"} onClick={() => navigate("/patient/billing")} />
          <StatCard title={t("activePrescription", "Active Prescription")} value={data?.prescriptionsActive ?? "—"} onClick={() => navigate("/patient/prescriptions")} />
          <StatCard title={t("labResults", "Lab Results")} value={data?.labResults ?? "—"} onClick={() => navigate("/patient/lab-results")} />
        </div>
      </DashboardSection>

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

      <DashboardSection className="doctor-main-grid" title={t("healthTimeline", "Health Timeline")} subtitle={t("Move across your care history and active patient workflows.", "Move across your care history and active patient workflows.")}>
        <div className="card doctor-schedule-card">
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
      </DashboardSection>
    </DashboardHomeShell>
  );
}
