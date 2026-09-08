import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";
import { usePatientDashboard } from "../../hooks/usePatientDashboard";

const PATIENT_ROUTES = Object.freeze({
  appointments: "/app/portal/appointments/index",
  billing: "/app/portal/billing/index",
  familyRecords: "/app/portal/family/records",
  familyTimeline: "/app/portal/family/timeline",
  feedback: "/app/portal/support/feedback",
  labResults: "/app/portal/diagnostics/lab-results",
  medicalRecords: "/app/portal/records/index",
  notifications: "/app/platform/inbox/notifications",
  prescriptions: "/app/portal/medications/prescriptions",
  profile: "/app/platform/account/profile",
  reports: "/app/platform/reports/index",
});

export default function Dashboard() {
  const { t } = usePatientLanguage();
  const navigate = useNavigate();
  const { data, latestVisit, latestEncounter, latestPrescription, latestReferral } = usePatientDashboard();

  const linkedChildrenCount = Number(data?.familyMonitoring?.linkedMinorCount || 0);
  const latestPrescriptionStatus = latestPrescription?.status || t("notAvailable", "Not available");
  const latestReferralStatus = latestReferral?.status || t("notAvailable", "Not available");
  const latestVisitStatus = latestVisit || latestEncounter ? t("ready", "Ready") : t("noneYet", "None yet");
  const openAiAssistant = (prompt) => {
    window.dispatchEvent(
      new CustomEvent("afyalink:ai-open", {
        detail: {
          prompt,
          source: "patient-dashboard",
        },
      })
    );
  };
  const careRecommendations = useMemo(() => {
    const rows = [];
    const upcomingAppointments = Number(data?.upcomingAppointments || 0);
    const activePrescriptions = Number(data?.prescriptionsActive || 0);
    const labResults = Number(data?.labResults || 0);
    const followUpDate = latestVisit?.metadata?.consultationSummary?.followUpDate;

    if (upcomingAppointments > 0) {
      rows.push({
        title: t("prepareForAppointment", "Prepare for your appointment"),
        body: t(
          "prepareForAppointmentBody",
          "Use the AI assistant to list symptoms, medicines, and questions before you meet the clinician."
        ),
        actionLabel: t("askAi", "Ask AI"),
        aiPrompt: "Help me prepare for my upcoming appointment. Suggest what symptoms, medicines, allergies, and questions I should organize before seeing the doctor.",
      });
    } else {
      rows.push({
        title: t("bookCareVisit", "Book a care visit"),
        body: t("bookCareVisitBody", "Choose a hospital service and schedule your next appointment."),
        actionLabel: t("bookAppointment", "Book Appointment"),
        path: PATIENT_ROUTES.appointments,
      });
    }

    if (latestPrescription || activePrescriptions > 0) {
      rows.push({
        title: t("understandPrescription", "Understand your prescription"),
        body: t("understandPrescriptionBody", "Get a simple explanation of how to take medicines and what to ask your doctor."),
        actionLabel: t("explainWithAi", "Explain With AI"),
        aiPrompt: `Explain my latest prescription in simple patient language. Status: ${latestPrescriptionStatus}. Summary: ${latestPrescription?.summary || "No summary available"}. Advice: ${latestPrescription?.advice || "No advice available"}.`,
      });
    }

    if (followUpDate) {
      rows.push({
        title: t("followUpRecommended", "Follow-up recommended"),
        body: `${t("followUp", "Follow-up")}: ${new Date(followUpDate).toLocaleDateString()}`,
        actionLabel: t("openAppointments", "Open Appointments"),
        path: PATIENT_ROUTES.appointments,
      });
    }

    if (labResults > 0) {
      rows.push({
        title: t("reviewLabResults", "Review lab results"),
        body: t("reviewLabResultsBody", "Open completed results and ask AI to prepare questions for your clinician."),
        actionLabel: t("explainResults", "Explain Results"),
        aiPrompt: "Explain my latest lab results in simple language and list questions I should ask my clinician. Do not diagnose me; help me understand what to review with a professional.",
      });
    }

    if (!rows.length) {
      rows.push({
        title: t("annualCheckupReminder", "Plan a routine checkup"),
        body: t("annualCheckupReminderBody", "If you are not sure which service you need, the AI assistant can help you prepare."),
        actionLabel: t("askAi", "Ask AI"),
        aiPrompt: "Help me decide what type of routine checkup or appointment I should consider based on general health maintenance.",
      });
    }

    return rows.slice(0, 4);
  }, [data, latestPrescription, latestPrescriptionStatus, latestVisit, t]);

  return (
    <DashboardHomeShell
      className="patient-dashboard-shell"
      shellKey="patient-dashboard"
      kicker="Patient workspace"
      title={t("dashboardTitle", "Patient Self-Service Portal")}
      subtitle={t("dashboardSubtitle", "Simple patient view for appointments, results, bills, and insurance.")}
      actions={[
        { label: t("myAppointments", "My Appointments"), path: PATIENT_ROUTES.appointments },
        { label: t("billing", "Billing"), path: PATIENT_ROUTES.billing, variant: "secondary" },
        { label: t("familyRecords", "Family Records"), path: PATIENT_ROUTES.familyRecords, variant: "secondary" },
        { label: t("profile", "Profile"), path: PATIENT_ROUTES.profile, variant: "secondary" },
      ]}
      stats={[
        { label: t("upcomingAppointment", "Upcoming Appointment"), value: data?.upcomingAppointments ?? "—", path: PATIENT_ROUTES.appointments },
        { label: t("outstandingBill", "Outstanding Bill"), value: data?.unpaidInvoices ?? "—", path: PATIENT_ROUTES.billing },
        { label: t("activePrescription", "Active Prescription"), value: data?.prescriptionsActive ?? "—", path: PATIENT_ROUTES.prescriptions },
        { label: t("labResults", "Lab Results"), value: data?.labResults ?? "—", path: PATIENT_ROUTES.labResults },
      ]}
      brief={{
        kicker: t("dailyBrief", "Daily brief"),
        title: t("whatNeedsActionNext", "What needs action next"),
        body: t(
          "patientDailyBriefBody",
          "Start with upcoming appointments, pending bills, and any follow-ups."
        ),
        items: [
          { label: t("upcomingAppointments", "Upcoming appointments"), value: data?.upcomingAppointments ?? "—" },
          {
            label: t("outstandingBill", "Outstanding bill"),
            value: data?.unpaidInvoices ?? "—",
            tone: Number(data?.unpaidInvoices || 0) > 0 ? "warn" : "good",
          },
          { label: t("prescriptionStatus", "Prescription status"), value: latestPrescriptionStatus },
          { label: t("referralStatus", "Referral status"), value: latestReferralStatus },
        ],
      }}
      runway={[
        {
          id: "patient-runway-appointments",
          title: t("reviewUpcomingAppointments", "Review upcoming appointments"),
          description: t(
            "Keep your scheduled visits, confirmations, and clinic timing in one place.",
            "Keep your scheduled visits, confirmations, and clinic timing in one place."
          ),
          eyebrow: t("care", "Care"),
          path: PATIENT_ROUTES.appointments,
          badge: `${data?.upcomingAppointments ?? 0}`,
        },
        {
          id: "patient-runway-billing",
          title: t("checkBillingAndInsurance", "Check billing and insurance"),
          description: t(
            "Open outstanding bills, insurance posture, and payment follow-up without digging.",
            "Open outstanding bills, insurance posture, and payment follow-up without digging."
          ),
          eyebrow: t("coverage", "Coverage"),
          path: PATIENT_ROUTES.billing,
          badge: `${data?.unpaidInvoices ?? 0}`,
        },
        {
          id: "patient-runway-family",
          title: t("trackFamilyRecords", "Track family records"),
          description: t(
            "See linked children, family care history, and guardian monitoring from one view.",
            "See linked children, family care history, and guardian monitoring from one view."
          ),
          eyebrow: t("family", "Family"),
          path: PATIENT_ROUTES.familyRecords,
          badge: `${linkedChildrenCount}`,
        },
        {
          id: "patient-runway-feedback",
          title: t("shareFeedback", "Share feedback"),
          description: t(
            "Send questions, service feedback, or follow-up requests from your patient workspace.",
            "Send questions, service feedback, or follow-up requests from your patient workspace."
          ),
          eyebrow: t("support", "Support"),
          path: PATIENT_ROUTES.feedback,
          badge: t("open", "Open"),
        },
      ]}
      pinnedTools={[
        {
          id: "patient-tool-records",
          title: t("medicalRecords", "Medical Records"),
          description: t("Open your care history, reports, and visit context quickly.", "Open your care history, reports, and visit context quickly."),
          eyebrow: t("records", "Records"),
          path: PATIENT_ROUTES.medicalRecords,
          variant: "compact",
        },
        {
          id: "patient-tool-family-timeline",
          title: t("familyTimeline", "Family Timeline"),
          description: t("Move from one family care event to the next without losing context.", "Move from one family care event to the next without losing context."),
          eyebrow: t("family", "Family"),
          path: PATIENT_ROUTES.familyTimeline,
          variant: "compact",
        },
        {
          id: "patient-tool-vacancies",
          title: t("vacancyFeed", "Vacancy Feed"),
          description: t("Keep hospital opportunities and announcements close to your home view.", "Keep hospital opportunities and announcements close to your home view."),
          eyebrow: t("community", "Community"),
          path: "/careers",
          variant: "compact",
        },
      ]}
      recentItems={[
        {
          id: "patient-recent-reports",
          title: t("reports", "Reports"),
          description: t("Return to recent clinical documents, summaries, and supporting reports.", "Return to recent clinical documents, summaries, and supporting reports."),
          eyebrow: t("recent", "Recent"),
          path: PATIENT_ROUTES.reports,
          variant: "compact",
        },
        {
          id: "patient-recent-messages",
          title: t("messages", "Messages"),
          description: t("Re-open notifications, updates, and daily wellness quotes quickly.", "Re-open notifications, updates, and daily wellness quotes quickly."),
          eyebrow: t("recent", "Recent"),
          path: PATIENT_ROUTES.notifications,
          variant: "compact",
        },
      ]}
      savedViews={[
        {
          id: "patient-view-bills",
          title: t("outstandingBillsView", "Outstanding bills"),
          description: t("Saved entry into the billing items that still need your attention.", "Saved entry into the billing items that still need your attention."),
          eyebrow: t("savedView", "Saved view"),
          path: PATIENT_ROUTES.billing,
          variant: "compact",
        },
        {
          id: "patient-view-family",
          title: t("familyCareView", "Family care view"),
          description: t("Saved entry into linked children, monitoring, and care continuity.", "Saved entry into linked children, monitoring, and care continuity."),
          eyebrow: t("savedView", "Saved view"),
          path: PATIENT_ROUTES.familyRecords,
          variant: "compact",
        },
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
            { label: t("openFamilyTimeline", "Open Family Timeline"), path: PATIENT_ROUTES.familyTimeline, variant: "secondary" },
            { label: t("openNotifications", "Open Notifications"), path: PATIENT_ROUTES.notifications, variant: "secondary" },
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
            { label: t("messages", "Messages"), path: PATIENT_ROUTES.notifications, variant: "secondary" },
            { label: t("feedback", "Feedback"), path: PATIENT_ROUTES.feedback, variant: "secondary" },
          ],
        },
      ]}
    >
      <DashboardSection
        className="patient-ai-recommendations"
        title={t("recommendedForYou", "Recommended For You")}
        subtitle={t("recommendedForYouSubtitle", "Helpful next steps based on appointments, prescriptions, lab results, and records.")}
        actions={[
          {
            label: t("askAi", "Ask AI"),
            variant: "secondary",
            onClick: () =>
              openAiAssistant("Review my AfyaLink dashboard and help me choose the most useful next step today."),
          },
        ]}
      >
        <div className="ai-recommendations-grid">
          {careRecommendations.map((item) => (
            <article className="premium-card ai-recommendation-card" key={`${item.title}-${item.actionLabel}`}>
              <div className="ai-recommendation-marker" aria-hidden="true">
                AI
              </div>
              <div>
                <h4>{item.title}</h4>
                <p className="muted">{item.body}</p>
              </div>
              <div className="doctor-actions-row">
                <button
                  type="button"
                  className={item.path ? "btn-secondary" : "btn-primary"}
                  onClick={() => {
                    if (item.aiPrompt) {
                      openAiAssistant(item.aiPrompt);
                      return;
                    }
                    if (item.path) navigate(item.path);
                  }}
                >
                  {item.actionLabel}
                </button>
                {item.path && item.aiPrompt ? (
                  <button type="button" className="btn-secondary" onClick={() => navigate(item.path)}>
                    {t("open", "Open")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        className="doctor-main-grid"
        title={t("latestVisitSummary", "Latest Visit Summary")}
        subtitle={t("latestVisitSummarySubtitle", "See your last visit context and choose the next step.")}
      >
        <div className="card doctor-alerts-card">
          {latestVisit || latestEncounter ? (
            <div className="alert-stack">
              <div className="card">
                <strong>
                  {latestEncounter?.diagnosis ||
                    latestVisit?.metadata?.consultationSummary?.diagnosis ||
                    latestVisit?.serviceType ||
                    t("recentVisit", "Recent Visit")}
                </strong>
                <p className="muted" style={{ marginTop: 8 }}>
                  {latestVisit?.metadata?.consultationSummary?.carePlan ||
                    latestVisit?.notes ||
                    latestEncounter?.consultationNotes ||
                    t("noDetailedSummary", "No detailed summary yet.")}
                </p>
                <p className="muted" style={{ marginTop: 8 }}>
                  {latestEncounter?.labSummary?.count
                    ? `${t("labs", "Labs")}: ${latestEncounter.labSummary.count}`
                    : t("noLabs", "No labs")}
                  {latestEncounter?.billing?.invoiceNumber
                    ? ` • ${t("invoice", "Invoice")}: ${latestEncounter.billing.invoiceNumber} (${latestEncounter.billing.status})`
                    : ` • ${t("noBilling", "No billing")}`}
                  {latestEncounter?.prescriptionSummary?.count
                    ? ` • ${t("prescriptions", "Prescriptions")}: ${latestEncounter.prescriptionSummary.count} (${latestEncounter.prescriptionSummary.latestStatus})`
                    : ` • ${t("noPrescriptions", "No prescriptions")}`}
                </p>
                {latestVisit?.metadata?.consultationSummary?.followUpDate ? (
                  <div className="action-pill">
                    {t("followUp", "Follow-up")}:{" "}
                    {new Date(latestVisit.metadata.consultationSummary.followUpDate).toLocaleDateString()}
                  </div>
                ) : latestEncounter?.closedAt ? (
                  <div className="action-pill">
                    {t("closed", "Closed")}: {new Date(latestEncounter.closedAt).toLocaleDateString()}
                  </div>
                ) : null}
                <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                  <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.appointments)}>
                    {t("openAppointments", "Open Appointments")}
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.prescriptions)}>
                    {t("prescriptions", "Prescriptions")}
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.medicalRecords)}>
                    {t("medicalRecords", "Medical Records")}
                  </button>
                </div>
              </div>
              <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.notifications)}>
                {t("messages", "Messages")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.feedback)}>
                {t("feedback", "Feedback")}
              </button>
            </div>
          ) : (
            <div className="alert-stack">
              <div className="muted">{t("noRecentVisitSummary", "No recent visit summary yet.")}</div>
              <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.notifications)}>
                {t("messages", "Messages")}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate(PATIENT_ROUTES.feedback)}>
                {t("feedback", "Feedback")}
              </button>
            </div>
          )}
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
