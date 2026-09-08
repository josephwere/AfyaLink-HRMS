import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConsultationRoom from "../../components/ConsultationRoom";
import { useDoctorSchedule } from "../../hooks/useDoctorSchedule";
import { useAuth } from "../../utils/auth";
import { normalizeRole } from "../../utils/normalizeRole";
import { canStartRemoteConsultation, getAppointmentLifecycleState } from "../../utils/appointmentLifecycle";

const CALENDAR_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#b45309", "#be123c", "#047857", "#334155"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALL_INBOX_ROLES = new Set(["DOCTOR", "SURGEON", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]);
const CLINIC_SETTINGS_ROLES = new Set(["DOCTOR", "SURGEON"]);

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

function formatMonthYear(value) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(value);
}

function formatFullDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not set";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function buildMonthDays(anchorDate) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function getPatientName(item) {
  if (item?.patient?.firstName) {
    return `${item.patient.firstName} ${item.patient.lastName || ""}`.trim();
  }
  return item?.patient?.name || item?.patientName || "Patient";
}

function getHospitalName(item) {
  if (item?.hospital?.name) return item.hospital.name;
  if (item?.hospitalName) return item.hospitalName;
  if (item?.metadata?.hospitalName) return item.metadata.hospitalName;
  return "AfyaLink Hospital";
}

function eventColorFor(hospitalName, hospitalNames) {
  const index = Math.max(0, hospitalNames.indexOf(hospitalName));
  return CALENDAR_COLORS[index % CALENDAR_COLORS.length];
}

export default function MySchedule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");
  const isClinicUser = CLINIC_SETTINGS_ROLES.has(role);
  const canUseCallInbox = CALL_INBOX_ROLES.has(role);
  const appointmentsSectionRef = useRef(null);
  const callsSectionRef = useRef(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
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
    startAppointmentConsultation,
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

  const appointmentEvents = useMemo(() => {
    return (appointments || [])
      .map((item) => {
        const when = item?.scheduledAt ? new Date(item.scheduledAt) : null;
        if (!when || Number.isNaN(when.getTime())) return null;
        return {
          item,
          key: dateKey(when),
          when,
          status: item.status || "Scheduled",
          service: item.serviceType || item.type || "Appointment",
          patient: getPatientName(item),
          hospital: getHospitalName(item),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.when - b.when);
  }, [appointments]);

  const hospitalNames = useMemo(() => {
    const names = appointmentEvents.map((event) => event.hospital).filter(Boolean);
    return Array.from(new Set(names));
  }, [appointmentEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    appointmentEvents.forEach((event) => {
      const list = map.get(event.key) || [];
      list.push(event);
      map.set(event.key, list);
    });
    return map;
  }, [appointmentEvents]);

  const selectedEvents = eventsByDay.get(dateKey(selectedDate)) || [];
  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const completedTodayCalls = useMemo(() => {
    return (calls || []).filter((call) => {
      const status = String(call.status || "").toUpperCase();
      const when = call.endedAt || call.updatedAt || call.createdAt;
      return ["ENDED", "COMPLETED"].includes(status) && when && sameDay(when, new Date());
    });
  }, [calls]);

  const goToToday = () => {
    const today = startOfDay(new Date());
    setCalendarMonth(today);
    setSelectedDate(today);
  };

  const moveMonth = (amount) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="dashboard doctor-workspace shared-calendar-workspace">
      <div className="welcome-panel calendar-hero">
        <div>
          <span className="premium-shell-kicker">Shared calendar</span>
          <h2>My Calendar</h2>
          <p className="muted">Review appointments, consultation sessions, hospital schedules, dates, and year context in one place.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing" : "Refresh"}
          </button>
          <button type="button" className="btn-secondary" onClick={goToToday}>
            Today
          </button>
          {isClinicUser ? (
            <button type="button" className="btn-primary" onClick={() => navigate("/app/platform/account/clinician-settings")}>
              Edit Availability
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => navigate("/app/platform/account/profile")}>
              Profile
            </button>
          )}
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}
      {activeCall && isClinicUser && (
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
        <div className="calendar-summary-grid">
          <button type="button" className="card stat stat-clickable" onClick={() => focusSection(appointmentsSectionRef)}>
            <div className="card-title">Today</div>
            <div className="card-value">{todayAppointments.length}</div>
            <div className="card-sub">{formatFullDate(new Date())}</div>
          </button>
          <button type="button" className="card stat stat-clickable" onClick={() => setSelectedDate(startOfDay(new Date()))}>
            <div className="card-title">Selected Day</div>
            <div className="card-value">{selectedEvents.length}</div>
            <div className="card-sub">{formatFullDate(selectedDate)}</div>
          </button>
          <button type="button" className="card stat stat-clickable" onClick={() => focusSection(callsSectionRef)} disabled={!canUseCallInbox}>
            <div className="card-title">Consultation Requests</div>
            <div className="card-value">{canUseCallInbox ? requestedCalls.length : "0"}</div>
            <div className="card-sub">{canUseCallInbox ? "Live call inbox" : "Calendar only"}</div>
          </button>
          <button
            type="button"
            className="card stat stat-clickable"
            onClick={() => {
              const openCall = activeCalls[0];
              if (openCall && isClinicUser) {
                setActiveCall(openCall);
                return;
              }
              focusSection(callsSectionRef);
            }}
            disabled={!canUseCallInbox}
          >
            <div className="card-title">{isClinicUser ? "Clinic Open" : "Calendar Status"}</div>
            <div className="card-value">
              {isClinicUser
                ? todayAvailability?.consultationAvailable === false
                  ? "Consults Off"
                  : todayAvailability?.isAvailable === false
                  ? "Bookings Off"
                  : "Open"
                : "Ready"}
            </div>
            <div className="card-sub">{availability.length ? `${availability.length} availability rules` : "Role-safe calendar access"}</div>
          </button>
        </div>
      </section>

      <section className="section shared-calendar-shell">
        <div className="card shared-calendar-card">
          <div className="calendar-toolbar">
            <div>
              <span className="premium-shell-kicker">Month view</span>
              <h3>{formatMonthYear(calendarMonth)}</h3>
            </div>
            <div className="doctor-actions-row">
              <button type="button" className="btn-secondary" onClick={() => moveMonth(-1)}>
                Previous
              </button>
              <button type="button" className="btn-secondary" onClick={() => moveMonth(1)}>
                Next
              </button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {DAY_LABELS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-month-grid">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay.get(key) || [];
              const inMonth = day.getMonth() === calendarMonth.getMonth();
              const isToday = sameDay(day, new Date());
              const isSelected = sameDay(day, selectedDate);
              return (
                <button
                  type="button"
                  key={key}
                  className={[
                    "calendar-day-cell",
                    inMonth ? "" : "is-muted",
                    isToday ? "is-today" : "",
                    isSelected ? "is-selected" : "",
                    dayEvents.length ? "has-events" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedDate(startOfDay(day))}
                >
                  <span className="calendar-day-number">{day.getDate()}</span>
                  <span className="calendar-day-year">{day.getFullYear()}</span>
                  <span className="calendar-event-stack">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.item?._id || `${event.key}-${event.service}-${event.patient}`}
                        className="calendar-event-chip"
                        style={{ "--event-color": eventColorFor(event.hospital, hospitalNames) }}
                      >
                        {formatTime(event.when)} {event.service}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? <span className="calendar-more-chip">+{dayEvents.length - 3} more</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="card calendar-day-panel">
          <span className="premium-shell-kicker">Selected date</span>
          <h3>{formatFullDate(selectedDate)}</h3>
          {hospitalNames.length > 0 ? (
            <div className="calendar-hospital-legend">
              {hospitalNames.map((name) => (
                <span key={name} className="calendar-legend-item">
                  <span style={{ background: eventColorFor(name, hospitalNames) }} />
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Hospital calendars will appear here as appointments are scheduled.</p>
          )}

          <div className="calendar-selected-events">
            {selectedEvents.length > 0 ? (
              selectedEvents.map((event) => (
                <article
                  key={event.item?._id || `${event.key}-${event.service}-${event.patient}`}
                  className="calendar-selected-event"
                  style={{ "--event-color": eventColorFor(event.hospital, hospitalNames) }}
                >
                  <div>
                    <strong>{event.service}</strong>
                    <p className="muted">{event.patient}</p>
                  </div>
                  <div className="calendar-selected-meta">
                    <span>{formatTime(event.when)}</span>
                    <span>{event.status}</span>
                    <span>{event.hospital}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="dashboard-empty-state">
                <strong>No events on this date.</strong>
                <p className="muted">Appointments and hospital calendar activity will appear here when available.</p>
              </div>
            )}
          </div>
        </aside>
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
                  <th>Hospital</th>
                  <th>Service</th>
                  <th>Mode</th>
                  <th>Assignment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((item) => (
                  <tr key={item._id}>
                    <td>{item.scheduledAt ? formatTime(item.scheduledAt) : "Time not set"}</td>
                    <td>{getPatientName(item)}</td>
                    <td>{getHospitalName(item)}</td>
                    <td>{item.serviceType || "General Consultation"}</td>
                    <td>{String(item.consultationMode || "IN_PERSON").replace(/_/g, " ")}</td>
                    <td>{item.doctor ? (typeof item.doctor === "object" ? item.doctor.name : String(item.doctor)) : "Awaiting assignment"}</td>
                    <td>
                      <span className={`action-pill ${getAppointmentLifecycleState(item).tone}`}>{getAppointmentLifecycleState(item).label}</span>
                      {item.consultationMode && ["VIDEO", "VOICE"].includes(String(item.consultationMode).toUpperCase()) ? (
                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void startAppointmentConsultation(item)}
                            disabled={!canStartRemoteConsultation(item)}
                            title={canStartRemoteConsultation(item) ? "Start the remote consultation" : "The patient must be checked in before remote consultation can start"}
                          >
                            {canStartRemoteConsultation(item) ? "Start remote" : "Await check-in"}
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 6 }}><span className="muted">In-person</span></div>
                      )}
                      {isClinicUser && (() => {
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
                                  `/app/care/encounters/opd?patientId=${encodeURIComponent(patientKey)}${missing ? `&focus=${encodeURIComponent(missing)}` : ""}`
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
                                onClick={() => handleResolveEscalation(encounter, patientKey)}
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
                    <td colSpan={7} className="muted">No appointments for today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card" ref={callsSectionRef}>
          <h3>{canUseCallInbox ? "Consultation Inbox" : "Calendar Guidance"}</h3>
          {canUseCallInbox ? (
            <>
              <p className="muted">Incoming requests stay here until accepted or declined. Accepted calls open in the secure room automatically.</p>
              <div className="alert-stack">
                {[...requestedCalls, ...activeCalls].map((call) => (
                  <div key={call._id} className="consultation-inbox-card">
                    <span className="telehealth-kicker">
                      {call.status === "REQUESTED" ? "Incoming Consultation Request" : "Consultation Ready"}
                    </span>
                    <div><strong>{getPatientName(call)}</strong></div>
                    <div className="muted">
                      Service: {call.appointment?.serviceType || "General Consultation"} - Mode: {call.callType === "VIDEO" ? "Video" : "Voice"}
                    </div>
                    <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                      {call.status === "REQUESTED" && isClinicUser ? (
                        <button type="button" className="btn-primary" onClick={() => runCallAction(call, "activate")}>
                          Accept
                        </button>
                      ) : null}
                      {call.status === "REQUESTED" && isClinicUser ? (
                        <button type="button" className="btn-secondary" onClick={() => runCallAction(call, "end")}>
                          Decline
                        </button>
                      ) : null}
                      {call.status === "ACTIVE" && isClinicUser ? (
                        <button type="button" className="btn-primary" onClick={() => setActiveCall(call)}>
                          Enter Consultation
                        </button>
                      ) : null}
                      {call.status === "ACTIVE" && isClinicUser ? (
                        <button type="button" className="btn-secondary" onClick={() => runCallAction(call, "end")}>
                          Mark Completed
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!requestedCalls.length && !activeCalls.length ? <div className="muted">No consultation requests right now.</div> : null}
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
            </>
          ) : (
            <div className="dashboard-empty-state">
              <strong>Your calendar is ready.</strong>
              <p className="muted">Use the month view to track appointments, hospital activity, and upcoming care events.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
