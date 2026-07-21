import React, { useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import ConsultationRoom from "../../components/ConsultationRoom";
import { useDoctorSchedule } from "../../hooks/useDoctorSchedule";

export default function MySchedule() {
  const navigate = useNavigate();
  const appointmentsSectionRef = useRef(null);
  const callsSectionRef = useRef(null);
  const {
    appointments,
    calls,
    availability,
    encounterByPatient,
    activeCall,
    setActiveCall,
    msg,
    loading,
    resolvingEncounterId,
    todayAppointments,
    todayAvailability,
    requestedCalls,
    activeCalls,
    load,
    runCallAction,
    resolveEscalation,
  } = useDoctorSchedule();

  const focusSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const closeoutLabel = (encounter) => {
    if (!encounter?._id) return "No visit";
    if (encounter?.closeout?.canClose) return "Ready to close";
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Pending: ${missing}` : "Requirements pending";
  };
  const escalationLabel = (encounter) => {
    if (!encounter?.escalationSummary?.count || encounter?.escalationSummary?.openCount === 0) return "";
    if (encounter.escalationSummary.unreadMine > 0) return "Nurse escalation";
    return "Escalation open";
  };
  const firstMissingRequirement = (encounter) => {
    const items = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements
      : [];
    return items[0] || "";
  };

  const handleResolveEscalation = async (encounter, patientKey) => {
    const redirectPath = await resolveEscalation(encounter, patientKey);
    if (redirectPath) {
      navigate(redirectPath);
    }
  };

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>My Schedule</h2>
          <p className="muted">See today’s patient flow, accept consultation calls, and watch your clinic status.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <Link className="btn-primary" to="/doctor/settings">
            Edit Availability
          </Link>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}
      {activeCall && (
        <ConsultationRoom
          call={activeCall}
          role="DOCTOR"
          autoJoin
          onClose={() => setActiveCall(null)}
          onEnded={async (call) => {
            await runCallAction(call, "end", { keepRoomOpen: true });
          }}
        />
      )}

      <section className="section">
        <h3>Today's Schedule</h3>
        <div className="grid info-grid">
          <div
            className="card stat stat-clickable"
            role="button"
            tabIndex={0}
            onClick={() => focusSection(appointmentsSectionRef)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") focusSection(appointmentsSectionRef);
            }}
          >
            <div className="card-title">Appointments</div>
            <div className="card-value">{todayAppointments.length}</div>
          </div>
          <div
            className="card stat stat-clickable"
            role="button"
            tabIndex={0}
            onClick={() => focusSection(callsSectionRef)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") focusSection(callsSectionRef);
            }}
          >
            <div className="card-title">Consultation Requests</div>
            <div className="card-value">{requestedCalls.length}</div>
          </div>
          <div
            className="card stat stat-clickable"
            role="button"
            tabIndex={0}
            onClick={() => {
              const openCall = activeCalls[0];
              if (openCall) {
                setActiveCall(openCall);
                return;
              }
              focusSection(callsSectionRef);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                const openCall = activeCalls[0];
                if (openCall) {
                  setActiveCall(openCall);
                  return;
                }
                focusSection(callsSectionRef);
              }
            }}
          >
            <div className="card-title">Active Consultation</div>
            <div className="card-value">{activeCalls.length}</div>
          </div>
          <div
            className="card stat stat-clickable"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/doctor/settings")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate("/doctor/settings");
            }}
          >
            <div className="card-title">Clinic Open</div>
            <div className="card-value">
              {todayAvailability?.consultationAvailable === false
                ? "Consults Off"
                : todayAvailability?.isAvailable === false
                ? "Bookings Off"
                : "Open"}
            </div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid" ref={appointmentsSectionRef}>
        <div className="card doctor-schedule-card">
          <h3>Today’s Appointments</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((item) => (
                  <tr key={item._id}>
                    <td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td>
                      {item.patient?.firstName
                        ? `${item.patient.firstName} ${item.patient.lastName || ""}`.trim()
                        : item.patient?.name || "Patient"}
                    </td>
                    <td>{item.serviceType || "General Consultation"}</td>
                    <td>{item.status || "Scheduled"}</td>
                    <td>
                      {item.notes ? String(item.notes).slice(0, 80) : "—"}
                      {item?.metadata?.consultationSummary?.diagnosis ? (
                        <div className="muted" style={{ marginTop: 4 }}>
                          Dx: {item.metadata.consultationSummary.diagnosis}
                        </div>
                      ) : null}
                      {(() => {
                        const patientKey = String(item?.patient?._id || item?.patient || "");
                        const encounter = encounterByPatient[patientKey];
                        if (!encounter) return null;
                        const missing = firstMissingRequirement(encounter);
                        return (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            <button
                              type="button"
                              className="action-pill"
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                navigate(
                                  `/doctor/opd?patientId=${encodeURIComponent(patientKey)}${missing ? `&focus=${encodeURIComponent(missing)}` : ""}`
                                )
                              }
                            >
                              {closeoutLabel(encounter)}
                            </button>
                            {escalationLabel(encounter) ? (
                              <button
                                type="button"
                                className="action-pill warning"
                                style={{ cursor: "pointer" }}
                                onClick={() => resolveEscalation(encounter, patientKey)}
                              >
                                {resolvingEncounterId === String(encounter._id) ? "Resolving..." : escalationLabel(encounter)}
                              </button>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
                {!todayAppointments.length && (
                  <tr>
                    <td colSpan={5} className="muted">No appointments for today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card" ref={callsSectionRef}>
          <h3>Consultation Inbox</h3>
          <p className="muted">Incoming requests stay here until accepted or declined. Accepted calls open in the secure room automatically.</p>
          <div className="alert-stack">
            {[...requestedCalls, ...activeCalls].map((call) => (
              <div key={call._id} className="consultation-inbox-card">
                <span className="telehealth-kicker">
                  {call.status === "REQUESTED" ? "Incoming Consultation Request" : "Consultation Ready"}
                </span>
                <div><strong>{call.patient?.firstName ? `${call.patient.firstName} ${call.patient.lastName || ""}`.trim() : call.patient?.name || "Patient"}</strong></div>
                <div className="muted">
                  Service: {call.appointment?.serviceType || "General Consultation"} • Mode: {call.callType === "VIDEO" ? "Video" : "Voice"}
                </div>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  {call.status === "REQUESTED" && (
                    <button type="button" className="btn-primary" onClick={() => runCallAction(call, "activate")}>
                      Accept
                    </button>
                  )}
                  {call.status === "REQUESTED" && (
                    <button type="button" className="btn-secondary" onClick={() => runCallAction(call, "end")}>
                      Decline
                    </button>
                  )}
                  {call.status === "ACTIVE" && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setActiveCall(call)}
                    >
                      Enter Consultation
                    </button>
                  )}
                  {call.status === "ACTIVE" && (
                    <button type="button" className="btn-secondary" onClick={() => runCallAction(call, "end")}>
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!requestedCalls.length && !activeCalls.length && <div className="muted">No consultation requests right now.</div>}
          </div>

          <div className="consultation-history-summary">
            <h4>Consultation History</h4>
            <div className="telehealth-readiness-grid compact">
              <div>
                <strong>Completed Today</strong>
                <span>{completedTodayCalls.length}</span>
              </div>
              <div>
                <strong>Voice</strong>
                <span>{completedTodayCalls.filter((call) => call.callType === "VOICE").length}</span>
              </div>
              <div>
                <strong>Video</strong>
                <span>{completedTodayCalls.filter((call) => call.callType === "VIDEO").length}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
