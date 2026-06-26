import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import ConsultationRoom from "../../components/ConsultationRoom";

export default function MySchedule() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [calls, setCalls] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [activeCall, setActiveCall] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingEncounterId, setResolvingEncounterId] = useState("");
  const appointmentsSectionRef = useRef(null);
  const callsSectionRef = useRef(null);

  const fetchEncounterSnapshots = async (appointmentRows) => {
    const patientIds = [...new Set(
      (Array.isArray(appointmentRows) ? appointmentRows : [])
        .map((item) => String(item?.patient?._id || item?.patient || ""))
        .filter(Boolean)
    )];
    if (!patientIds.length) {
      setEncounterByPatient({});
      return;
    }
    const pairs = await Promise.all(
      patientIds.map(async (patientId) => {
        try {
          const rows = await apiFetch(`/api/encounters?patientId=${encodeURIComponent(patientId)}&limit=1`);
          const items = Array.isArray(rows) ? rows : [];
          return [patientId, items[0] || null];
        } catch {
          return [patientId, null];
        }
      })
    );
    setEncounterByPatient(Object.fromEntries(pairs));
  };

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [appointmentsRes, callsRes, profileRes] = await Promise.all([
        apiFetch("/api/appointments?limit=25"),
        apiFetch("/api/appointments/calls"),
        apiFetch("/api/profile"),
      ]);
      const doctorId = profileRes?._id || profileRes?.id;
      const appointmentRows = Array.isArray(appointmentsRes?.items) ? appointmentsRes.items : [];
      setAppointments(appointmentRows);
      setCalls(Array.isArray(callsRes?.items) ? callsRes.items : []);
      await fetchEncounterSnapshots(appointmentRows);
      if (doctorId) {
        const availabilityRes = await apiFetch(`/api/appointments/doctors/${doctorId}/availability`);
        setAvailability(Array.isArray(availabilityRes?.items) ? availabilityRes.items : []);
      } else {
        setAvailability([]);
      }
    } catch (err) {
      setMsg(err?.message || "Failed to load schedule workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      load();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const todayAppointments = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return appointments.filter((item) => {
      const when = new Date(item.scheduledAt);
      return when >= start && when <= end;
    });
  }, [appointments]);

  const todayAvailability = useMemo(
    () => availability.find((row) => Number(row.dayOfWeek) === new Date().getDay()) || null,
    [availability]
  );
  const requestedCalls = useMemo(
    () => calls.filter((call) => String(call.status || "").toUpperCase() === "REQUESTED"),
    [calls]
  );
  const activeCalls = useMemo(
    () => calls.filter((call) => String(call.status || "").toUpperCase() === "ACTIVE"),
    [calls]
  );
  const completedTodayCalls = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return calls.filter((call) => {
      const status = String(call.status || "").toUpperCase();
      const endedAt = new Date(call.endedAt || call.updatedAt || call.createdAt);
      return ["ENDED", "TERMINATED"].includes(status) && endedAt >= start;
    });
  }, [calls]);

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

  const runCallAction = async (callOrId, action, options = {}) => {
    const callId = typeof callOrId === "string" ? callOrId : callOrId?._id;
    const sourceCall = typeof callOrId === "string" ? calls.find((item) => String(item._id) === String(callId)) : callOrId;
    const keepRoomOpen = Boolean(options.keepRoomOpen);
    if (!callId) return;
    try {
      setMsg("");
      const res = await apiFetch(`/api/appointments/calls/${callId}/${action}`, {
        method: "PATCH",
      });
      if (action === "activate") {
        setActiveCall({
          ...(sourceCall || {}),
          ...res,
          appointment: sourceCall?.appointment || res?.appointment,
          patient: sourceCall?.patient || res?.patient,
          doctor: sourceCall?.doctor || res?.doctor,
        });
        setMsg("Consultation accepted. Preparing secure consultation room...");
      } else {
        if (!keepRoomOpen) {
          setActiveCall((prev) => (String(prev?._id) === String(callId) ? null : prev));
        }
        setMsg(sourceCall?.status === "REQUESTED" ? "Consultation request declined." : "Consultation completed.");
      }
      window.dispatchEvent(new CustomEvent("afyalink:calls-refresh"));
      await load();
    } catch (err) {
      setMsg(err?.message || "Call action failed.");
    }
  };

  const resolveEscalation = async (encounter, patientKey) => {
    if (!encounter?._id) return;
    try {
      setResolvingEncounterId(String(encounter._id));
      setMsg("");
      await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/nurse-escalation-resolve`, {
        method: "POST",
        body: { note: "Clinician reviewed ward escalation and resumed visit workflow." },
      });
      const focus = firstMissingRequirement(encounter);
      navigate(
        `/doctor/opd?patientId=${encodeURIComponent(patientKey)}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`
      );
    } catch (err) {
      setMsg(err?.message || "Failed to resolve escalation.");
    } finally {
      setResolvingEncounterId("");
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
