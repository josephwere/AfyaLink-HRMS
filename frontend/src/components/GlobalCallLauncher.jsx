import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiFetch from "../utils/apiFetch";
import { useSocket } from "../utils/socket.jsx";
import ConsultationRoom from "./ConsultationRoom";

const PATIENT_HOSPITAL_KEY = "afyalink_patient_hospital_id";

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

function getPatientName(call) {
  const patient = call?.patient || call?.appointment?.patient;
  if (!patient || typeof patient === "string") return "Patient";
  return [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim() || patient.name || "Patient";
}

function getDoctorName(call) {
  const doctor = call?.doctor || call?.appointment?.doctor;
  if (!doctor || typeof doctor === "string") return "Assigned doctor";
  return doctor.name || "Assigned doctor";
}

function getServiceName(call) {
  return call?.appointment?.serviceType || call?.appointment?.reason || "General Consultation";
}

function playCallTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close?.(), 700);
  } catch {
    // Browsers may block autoplay audio until user interaction.
  }
}

function notifyBrowser(title, body) {
  try {
    if (!("Notification" in window) || window.Notification.permission !== "granted") return;
    new window.Notification(title, { body });
  } catch {
    // Browser notifications are optional and permission-dependent.
  }
}

export default function GlobalCallLauncher({ user }) {
  const role = normalizeRole(user?.role);
  const enabled = role === "PATIENT" || role === "DOCTOR";
  const socket = useSocket();
  const [calls, setCalls] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [remindedCall, setRemindedCall] = useState(null);
  const [incomingCountdown, setIncomingCountdown] = useState(8);
  const [message, setMessage] = useState("");
  const previousImportantCountRef = useRef(0);

  const importantCalls = useMemo(() => {
    if (role === "DOCTOR") {
      return calls.filter((call) => ["REQUESTED", "ACTIVE"].includes(String(call.status || "").toUpperCase()));
    }
    return calls.filter((call) => String(call.status || "").toUpperCase() === "ACTIVE");
  }, [calls, role]);

  const loadCalls = useCallback(async () => {
    if (!enabled) return;
    try {
      const selectedHospital =
        role === "PATIENT" ? localStorage.getItem(PATIENT_HOSPITAL_KEY) || "" : "";
      const suffix = selectedHospital ? `?hospitalId=${encodeURIComponent(selectedHospital)}` : "";
      const data = await apiFetch(`/api/appointments/calls${suffix}`, {
        cacheTtlMs: 3000,
        _skipUiProgress: true,
      });
      const rows = Array.isArray(data?.items) ? data.items : [];
      const actionableRows =
        role === "DOCTOR"
          ? rows.filter((call) => ["REQUESTED", "ACTIVE"].includes(String(call.status || "").toUpperCase()))
          : rows.filter((call) => String(call.status || "").toUpperCase() === "ACTIVE");
      if (actionableRows.length > previousImportantCountRef.current) {
        playCallTone();
        if (role === "PATIENT") {
          setIncomingCall(actionableRows[0]);
          setIncomingCountdown(8);
          notifyBrowser("Doctor accepted consultation", `${getDoctorName(actionableRows[0])} is ready.`);
        }
      }
      previousImportantCountRef.current = actionableRows.length;
      setCalls(rows);
      return rows;
    } catch {
      // Keep the launcher quiet if the current role cannot read consultation calls.
    }
    return [];
  }, [enabled, role]);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadCalls();
    };
    run();
    const timer = setInterval(run, 12000);
    const handleRefresh = () => run();
    window.addEventListener("afyalink:calls-refresh", handleRefresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("afyalink:calls-refresh", handleRefresh);
    };
  }, [enabled, loadCalls]);

  useEffect(() => {
    if (!enabled || !socket) return undefined;

    const loadAndFindCall = async (callId) => {
      const rows = await loadCalls();
      return rows.find((call) => String(call._id) === String(callId)) || null;
    };

    const handleRequested = async (event) => {
      if (role !== "DOCTOR") return;
      const call = await loadAndFindCall(event?.callId);
      if (call) {
        playCallTone();
        setOpen(true);
        setMessage(`Incoming consultation from ${getPatientName(call)}.`);
      }
    };

    const handleAccepted = async (event) => {
      const call = await loadAndFindCall(event?.callId);
      if (!call) return;
      if (role === "PATIENT") {
        playCallTone();
        setIncomingCall(call);
        setIncomingCountdown(8);
        setOpen(false);
        setRemindedCall(null);
        setMessage(`${getDoctorName(call)} accepted your consultation.`);
        notifyBrowser("Doctor accepted consultation", `${getDoctorName(call)} is ready to join.`);
      } else {
        setMessage("Consultation accepted. Preparing secure room.");
      }
    };

    const handleDeclined = async (event) => {
      await loadAndFindCall(event?.callId);
      if (role === "PATIENT") {
        setIncomingCall(null);
        setRemindedCall(null);
        setMessage("The doctor could not join this consultation. You can request another online consultation from your appointment.");
        setOpen(true);
      }
    };

    const handleCompleted = async (event) => {
      await loadAndFindCall(event?.callId);
      setIncomingCall(null);
      setRemindedCall(null);
      setActiveCall((current) => (String(current?._id) === String(event?.callId) ? null : current));
      if (role === "PATIENT") {
        setMessage("Consultation completed. Summary, prescription, or follow-up details will appear when available.");
      }
    };

    socket.on("consultation_requested", handleRequested);
    socket.on("consultation_accepted", handleAccepted);
    socket.on("consultation_declined", handleDeclined);
    socket.on("consultation_completed", handleCompleted);

    return () => {
      socket.off("consultation_requested", handleRequested);
      socket.off("consultation_accepted", handleAccepted);
      socket.off("consultation_declined", handleDeclined);
      socket.off("consultation_completed", handleCompleted);
    };
  }, [enabled, loadCalls, role, socket]);

  useEffect(() => {
    if (!incomingCall) return undefined;
    setIncomingCountdown(8);
    const timer = setInterval(() => {
      setIncomingCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setActiveCall(incomingCall);
          setIncomingCall(null);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [incomingCall]);

  useEffect(() => {
    if (!remindedCall) return undefined;
    const timer = setTimeout(() => {
      setMessage(`Missed Consultation: ${getDoctorName(remindedCall)} was ready. You can still join from Calls if the session is active.`);
      setOpen(true);
    }, 45000);
    return () => clearTimeout(timer);
  }, [remindedCall]);

  const activateCall = async (call) => {
    try {
      setMessage("Consultation accepted. Preparing secure consultation room...");
      const updated = await apiFetch(`/api/appointments/calls/${call._id}/activate`, {
        method: "PATCH",
      });
      setActiveCall({ ...call, ...updated, appointment: call.appointment, patient: call.patient, doctor: call.doctor });
      setOpen(false);
      window.dispatchEvent(new CustomEvent("afyalink:calls-refresh"));
    } catch (err) {
      setMessage(err?.message || "Could not accept consultation request.");
    }
  };

  const declineCall = async (call) => {
    try {
      await apiFetch(`/api/appointments/calls/${call._id}/end`, {
        method: "PATCH",
      });
      setMessage("Consultation request declined.");
      await loadCalls();
    } catch (err) {
      setMessage(err?.message || "Could not decline consultation request.");
    }
  };

  const endCall = async (call) => {
    await apiFetch(`/api/appointments/calls/${call._id}/end`, {
      method: "PATCH",
    });
    await loadCalls();
  };

  if (!enabled) return null;

  return (
    <div className="global-call-launcher">
      <button
        type="button"
        className={`global-call-button${importantCalls.length ? " has-calls" : ""}`}
        onClick={() => {
          try {
            if ("Notification" in window && window.Notification.permission === "default") {
              window.Notification.requestPermission?.();
            }
          } catch {
            // Notification permission prompts are best effort.
          }
          setOpen((current) => !current);
        }}
        aria-label={`Calls ${importantCalls.length}`}
        title="Calls"
      >
        <span className="global-call-icon">Call</span>
        <span>Calls</span>
        {importantCalls.length ? <strong>{importantCalls.length}</strong> : null}
      </button>

      {open ? (
        <div className="global-call-panel" role="dialog" aria-label="Consultation calls">
          <div className="global-call-panel-header">
            <strong>{role === "DOCTOR" ? "Consultation Requests" : "Consultation Ready"}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close calls panel">
              ×
            </button>
          </div>
          {message ? <p className="global-call-message">{message}</p> : null}
          <div className="global-call-list">
            {importantCalls.map((call) => {
              const status = String(call.status || "").toUpperCase();
              return (
                <div key={call._id} className="global-call-item">
                  <div>
                    <span className="telehealth-kicker">
                      {status === "REQUESTED" ? "Incoming Consultation Request" : "Doctor Joined"}
                    </span>
                    <strong>{role === "DOCTOR" ? getPatientName(call) : getDoctorName(call)}</strong>
                    <p>Service: {getServiceName(call)}</p>
                  </div>
                  <div className="global-call-actions">
                    {role === "DOCTOR" && status === "REQUESTED" ? (
                      <>
                        <button type="button" className="btn-primary" onClick={() => activateCall(call)}>
                          Accept
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => declineCall(call)}>
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setActiveCall(call);
                          setOpen(false);
                        }}
                      >
                        Join Consultation
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!importantCalls.length ? (
              <div className="global-call-empty">
                <strong>No active calls</strong>
                <p>Consultation requests will appear here when they need attention.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {incomingCall ? (
        <div className="incoming-call-overlay" role="dialog" aria-modal="true" aria-live="assertive">
          <div className="incoming-call-card">
            <div className="incoming-call-pulse" aria-hidden="true">Call</div>
            <span className="telehealth-kicker">Incoming Consultation</span>
            <h2>{getDoctorName(incomingCall)} is ready.</h2>
            <p>{getServiceName(incomingCall)}</p>
            <div className="incoming-call-countdown">
              Auto-joining in <strong>{incomingCountdown}</strong>
            </div>
            <div className="appointment-success-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setActiveCall(incomingCall);
                  setIncomingCall(null);
                }}
              >
                Join Now
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setRemindedCall(incomingCall);
                  setIncomingCall(null);
                  setMessage(`${getDoctorName(incomingCall)} is ready. You can join from Calls when you are ready.`);
                }}
              >
                Remind Me
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeCall ? (
        <ConsultationRoom
          call={activeCall}
          role={role}
          autoJoin
          onClose={() => {
            setActiveCall(null);
            loadCalls();
          }}
          onEnded={role === "DOCTOR" ? endCall : undefined}
        />
      ) : null}
    </div>
  );
}
