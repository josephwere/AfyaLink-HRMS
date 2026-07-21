import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { useDoctorDashboard } from "../../hooks/useDoctorDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const {
    dashboard: data,
    appointments,
    encounterByPatient,
    alerts,
    transfers,
    transferStats,
    resolveEscalation,
  } = useDoctorDashboard();
  const [resolvingEncounterId, setResolvingEncounterId] = useState("");

  const firstMissingRequirement = (encounter) => {
    const items = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements
      : [];
    return items[0] || "";
  };

  const closeoutLabel = (encounter) => {
    if (!encounter?._id) return "";
    if (encounter?.closeout?.canClose) return translateText("Ready to close");
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Pending: ${missing}` : translateText("Requirements pending");
  };

  const escalationLabel = (encounter) => {
    if (!encounter?.escalationSummary?.count || encounter?.escalationSummary?.openCount === 0) return "";
    return encounter.escalationSummary.unreadMine > 0 ? translateText("Nurse escalation") : translateText("Escalation open");
  };

  const handleResolveEscalation = async (encounter, patientKey) => {
    if (!encounter?._id) return;
    try {
      setResolvingEncounterId(String(encounter._id));
      await resolveEscalation(encounter._id, {
        note: "Clinician acknowledged dashboard escalation and resumed closeout workflow.",
      });
      navigate(
        `/doctor/opd${patientKey ? `?patientId=${encodeURIComponent(patientKey)}${firstMissingRequirement(encounter) ? `&focus=${encodeURIComponent(firstMissingRequirement(encounter))}` : ""}` : ""}`
      );
    } finally {
      setResolvingEncounterId("");
    }
  };

  return (
    <DashboardHomeShell
      className="doctor-workspace"
      shellKey="doctor-dashboard"
      kicker="Clinical workspace"
      title="Doctor Clinical Workspace"
      subtitle={`${translateText("Welcome")}, Dr. ${user?.name || translateText("Clinician")}. ${translateText("Keep patient care fast and clear.")}`}
      actions={[
        { label: "Open Patients", path: "/doctor/patients" },
        { label: "Write Notes", path: "/doctor/opd", variant: "secondary" },
        { label: "Complete Plan", path: "/doctor/prescriptions", variant: "secondary" },
        { label: "Ward Board", path: "/doctor/ward-board", variant: "secondary" },
      ]}
      stats={[
        { label: "Today’s Appointments", value: data?.appointmentsToday ?? "—", note: "Today's patient load", path: "/doctor/schedule" },
        { label: "Inpatients Assigned", value: data?.activeEncounters ?? "—", note: "Active responsibility", path: "/doctor/ward-board" },
        { label: "Pending Lab Results", value: data?.pendingLabResults ?? "—", note: "Awaiting review", path: "/doctor/lab-results" },
        { label: "Open Escalations", value: data?.escalationSummary?.openCount ?? "—", note: "Needs clinician review", path: "/doctor/escalations" },
      ]}
      brief={{
        kicker: "Daily brief",
        title: "What needs clinical attention now",
        body: "Start with today's appointments, escalation blockers, and transfer continuity so patient care stays fast and clear.",
        items: [
          { label: "Appointments today", value: data?.appointmentsToday ?? "—" },
          { label: "Open escalations", value: data?.escalationSummary?.openCount ?? "—", tone: Number(data?.escalationSummary?.openCount || 0) > 0 ? "warn" : "good" },
          { label: "Pending transfers", value: transferStats.pending, tone: transferStats.pending > 0 ? "warn" : "good" },
        ],
      }}
      runway={[
        { id: "doctor-runway-schedule", title: "Today’s schedule", description: "Open the day plan and appointment board fast.", eyebrow: "Schedule", path: "/doctor/schedule", badge: "Today" },
        { id: "doctor-runway-consult", title: "Start consultation", description: "Jump straight into OPD documentation and closeout tasks.", eyebrow: "Clinical", path: "/doctor/opd", badge: "OPD" },
        { id: "doctor-runway-escalations", title: "Resolve escalations", description: "Work through nurse-raised blockers before they delay patient throughput.", eyebrow: "Escalations", path: "/doctor/escalations", badge: "Review" },
        { id: "doctor-runway-transfers", title: "Transfer continuity", description: "Review handovers, transfer statuses, and inter-facility routing from one place.", eyebrow: "Continuity", path: "/doctor/transfers", badge: "Shared" },
      ]}
      pinnedTools={[
        { id: "doctor-pin-schedule", title: "My schedule", description: "Open the day plan and appointment board fast.", eyebrow: "Pinned", path: "/doctor/schedule", variant: "compact" },
        { id: "doctor-pin-availability", title: "My availability", description: "Keep clinic availability and consultation windows current.", eyebrow: "Pinned", path: "/doctor/settings", variant: "compact" },
        { id: "doctor-pin-ward", title: "Ward board", description: "Switch into inpatient flow without changing context.", eyebrow: "Pinned", path: "/doctor/ward-board", variant: "compact" },
      ]}
      recentItems={[
        { id: "doctor-recent-labs", title: "Pending labs", description: "Return to lab review quickly from the home surface.", eyebrow: "Recent", path: "/doctor/lab-results", variant: "compact" },
        { id: "doctor-recent-prescriptions", title: "Prescriptions", description: "Resume prescribing and medication review work.", eyebrow: "Recent", path: "/doctor/prescriptions", variant: "compact" },
      ]}
      savedViews={[
        { id: "doctor-view-escalations", title: "Escalations needing review", description: "A saved entry into unresolved nurse-raised blockers.", eyebrow: "Saved view", path: "/doctor/escalations", variant: "compact" },
        { id: "doctor-view-transfers", title: "Transfer queue", description: "Open the doctor transfer view with one click.", eyebrow: "Saved view", path: "/doctor/transfers", variant: "compact" },
      ]}
      contextCards={[
        {
          title: "Clinical context",
          subtitle: "Keep immediate patient pressure visible while you work the day.",
          items: [
            { label: "Surgeries scheduled", value: data?.upcomingAppointments ?? "—" },
            { label: "License expiry (days)", value: data?.licenseExpiryDays ?? "—", tone: Number(data?.licenseExpiryDays || 999) < 30 ? "warn" : "good" },
            { label: "Pending transfers", value: transferStats.pending, tone: transferStats.pending > 0 ? "warn" : "good" },
          ],
          actions: [
            { label: "My Availability", path: "/doctor/settings", variant: "secondary" },
            { label: "Open Transfers", path: "/doctor/transfers", variant: "secondary" },
          ],
        },
      ]}
    >

      <DashboardSection className="doctor-main-grid" title="Today’s schedule + alerts" subtitle="Appointments, current blockers, and the fastest action paths for the day.">
        <div className="card doctor-schedule-card">
          <h3>Today’s Schedule</h3>
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a._id}>
                    <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td>{a.type || "OPD"}</td>
                    <td>{a.patient?.name || a.patient?.firstName || "-"}</td>
                    <td>{a.status || "Scheduled"}</td>
                    <td>
                      <div className="doctor-actions-row">
                        {(() => {
                          const patientKey = String(a.patient?._id || a.patient || "");
                          const encounter = encounterByPatient[patientKey];
                          if (!encounter) return null;
                          return (
                            <>
                              <button
                                type="button"
                                className="action-pill"
                                onClick={() =>
                                  navigate(
                                    `/doctor/opd${patientKey ? `?patientId=${encodeURIComponent(patientKey)}${firstMissingRequirement(encounter) ? `&focus=${encodeURIComponent(firstMissingRequirement(encounter))}` : ""}` : ""}`
                                  )
                                }
                              >
                                {closeoutLabel(encounter)}
                              </button>
                              {escalationLabel(encounter) ? (
                                <button
                                  type="button"
                                  className="action-pill warning"
                                  onClick={() => handleResolveEscalation(encounter, patientKey)}
                                >
                                  {resolvingEncounterId === String(encounter._id) ? "Resolving..." : escalationLabel(encounter)}
                                </button>
                              ) : null}
                            </>
                          );
                        })()}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(`/doctor/medical-records${a.patient?._id ? `?patientId=${a.patient._id}` : ""}`)}
                        >
                          Open Record
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const patientKey = String(a.patient?._id || a.patient || "");
                            const encounter = encounterByPatient[patientKey];
                            const missing = firstMissingRequirement(encounter);
                            navigate(`/doctor/opd${patientKey ? `?patientId=${encodeURIComponent(patientKey)}${missing ? `&focus=${encodeURIComponent(missing)}` : ""}` : ""}`);
                          }}
                        >
                          Start Consultation
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="5" className="muted">No appointments</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts Panel</h3>
          <div className="alert-stack">
            {alerts.map((n) => (
              <button type="button" key={n._id} className="verify-banner" onClick={() => navigate("/notifications")}>
                <span>{n.title || "Clinical Alert"}</span>
              </button>
            ))}
            {alerts.length === 0 && <div className="muted">No alerts</div>}
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
