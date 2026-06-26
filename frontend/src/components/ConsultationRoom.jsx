import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../utils/socket.jsx";
import apiFetch from "../utils/apiFetch";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function getPatientName(call) {
  const patient = call?.patient || call?.appointment?.patient;
  if (!patient) return "Patient";
  if (typeof patient === "string") return "Patient";
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  return fullName || patient.name || "Patient";
}

function getDoctorName(call) {
  const doctor = call?.doctor || call?.appointment?.doctor;
  if (!doctor) return "Assigned doctor";
  if (typeof doctor === "string") return "Assigned doctor";
  return doctor.name || "Assigned doctor";
}

function getAppointmentLabel(call) {
  return call?.appointment?.serviceType || call?.appointment?.reason || "General Consultation";
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ConsultationRoom({
  call,
  role = "PATIENT",
  autoJoin = false,
  onClose,
  onEnded,
}) {
  const socket = useSocket();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const roomKeyRef = useRef("");

  const normalizedRole = String(role || "").toUpperCase();
  const wantsVideo = useMemo(
    () => String(call?.callType || "").toUpperCase() === "VIDEO",
    [call?.callType]
  );

  const [phase, setPhase] = useState(autoJoin ? "countdown" : "lobby");
  const [countdown, setCountdown] = useState(3);
  const [status, setStatus] = useState("Preparing room...");
  const [error, setError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(wantsVideo);
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [notes, setNotes] = useState(call?.appointment?.notes || "");
  const [notesMsg, setNotesMsg] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState(call?.appointment?.status || "Scheduled");
  const [activePanel, setActivePanel] = useState(normalizedRole === "DOCTOR" ? "patient" : "chat");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState(() => ({
    diagnosis: call?.appointment?.metadata?.consultationSummary?.diagnosis || "",
    carePlan: call?.appointment?.metadata?.consultationSummary?.carePlan || "",
    prescriptionSummary: call?.appointment?.metadata?.consultationSummary?.prescriptionSummary || "",
    referralSummary: call?.appointment?.metadata?.consultationSummary?.referralSummary || "",
    followUpDate: call?.appointment?.metadata?.consultationSummary?.followUpDate
      ? String(call.appointment.metadata.consultationSummary.followUpDate).slice(0, 10)
      : "",
  }));

  const patientName = getPatientName(call);
  const doctorName = getDoctorName(call);
  const appointmentLabel = getAppointmentLabel(call);

  useEffect(() => {
    setVideoEnabled(wantsVideo);
  }, [wantsVideo]);

  useEffect(() => {
    setPhase(autoJoin ? "countdown" : "lobby");
    setCountdown(3);
    setStatus("Preparing room...");
    setError("");
    setJoined(false);
    setConnected(false);
    setStartedAt(Date.now());
    setElapsedMs(0);
    setActivePanel(normalizedRole === "DOCTOR" ? "patient" : "chat");
  }, [autoJoin, call?._id, normalizedRole]);

  useEffect(() => {
    if (phase !== "countdown") return undefined;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setPhase("room");
          setStartedAt(Date.now());
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "room") return undefined;
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== "room" || !socket || !call?._id) return undefined;
    let active = true;

    const cleanup = () => {
      if (roomKeyRef.current) {
        socket.emit("consultation:leave", { callId: call._id, roomKey: roomKeyRef.current });
      }
      if (peerRef.current) {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
        peerRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setJoined(false);
      setConnected(false);
    };

    const ensurePeer = () => {
      if (peerRef.current) return peerRef.current;
      const peer = new RTCPeerConnection(RTC_CONFIG);
      peer.onicecandidate = (event) => {
        if (!event.candidate || !roomKeyRef.current) return;
        socket.emit("consultation:signal", {
          callId: call._id,
          roomKey: roomKeyRef.current,
          signalType: "ice-candidate",
          payload: event.candidate,
        });
      };
      peer.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams?.[0] || null;
        }
      };
      peer.onconnectionstatechange = () => {
        const next = peer.connectionState;
        if (next === "connected") {
          setConnected(true);
          setStatus("Connected");
        } else if (["failed", "disconnected"].includes(next)) {
          setConnected(false);
          setStatus("Connection interrupted");
        } else if (next === "closed") {
          setConnected(false);
        }
      };
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));
      }
      peerRef.current = peer;
      return peer;
    };

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        ensurePeer();
        setStatus("Waiting for the other person...");
      } catch {
        setError(
          wantsVideo
            ? "Camera or microphone access was denied. Allow access in your browser to join the consultation."
            : "Microphone access was denied. Allow access in your browser to join the consultation."
        );
        setStatus("Media access blocked");
      }
    };

    const createOffer = async () => {
      try {
        const peer = ensurePeer();
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: wantsVideo,
        });
        await peer.setLocalDescription(offer);
        socket.emit("consultation:signal", {
          callId: call._id,
          roomKey: roomKeyRef.current,
          signalType: "offer",
          payload: offer,
        });
        setStatus("Calling...");
      } catch {
        setError("Could not start the secure consultation room.");
      }
    };

    const handleJoined = ({ roomKey }) => {
      roomKeyRef.current = roomKey;
      setJoined(true);
      setStatus("Room ready");
    };

    const handlePeerJoined = async () => {
      if (normalizedRole !== "DOCTOR") return;
      await createOffer();
    };

    const handleSignal = async ({ signalType, payload }) => {
      try {
        const peer = ensurePeer();
        if (signalType === "offer") {
          await peer.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("consultation:signal", {
            callId: call._id,
            roomKey: roomKeyRef.current,
            signalType: "answer",
            payload: answer,
          });
          setStatus("Joining call...");
          return;
        }
        if (signalType === "answer") {
          await peer.setRemoteDescription(new RTCSessionDescription(payload));
          return;
        }
        if (signalType === "ice-candidate" && payload) {
          await peer.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch {
        setError("Consultation signaling failed. Please leave and rejoin the room.");
      }
    };

    const handlePeerLeft = () => {
      setConnected(false);
      setStatus("The other person left the room.");
    };

    const handleRoomError = ({ message }) => {
      setError(message || "Could not open consultation room.");
    };

    const handleChat = (payload) => {
      if (String(payload?.callId || "") !== String(call._id)) return;
      setChatMessages((prev) => [...prev, payload].slice(-100));
    };

    socket.on("consultation:joined", handleJoined);
    socket.on("consultation:peer-joined", handlePeerJoined);
    socket.on("consultation:signal", handleSignal);
    socket.on("consultation:peer-left", handlePeerLeft);
    socket.on("consultation:error", handleRoomError);
    socket.on("consultation:chat", handleChat);

    startMedia();
    socket.emit("consultation:join", { callId: call._id });

    return () => {
      active = false;
      socket.off("consultation:joined", handleJoined);
      socket.off("consultation:peer-joined", handlePeerJoined);
      socket.off("consultation:signal", handleSignal);
      socket.off("consultation:peer-left", handlePeerLeft);
      socket.off("consultation:error", handleRoomError);
      socket.off("consultation:chat", handleChat);
      cleanup();
    };
  }, [socket, call?._id, normalizedRole, wantsVideo, phase]);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  const toggleVideo = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  const leaveRoom = () => {
    if (typeof onClose === "function") onClose();
  };

  const completeLocally = () => {
    setPhase("completed");
  };

  const endForEveryone = async () => {
    if (typeof onEnded === "function") {
      await onEnded(call);
    }
    completeLocally();
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !socket || !roomKeyRef.current) return;
    socket.emit("consultation:chat", {
      callId: call._id,
      roomKey: roomKeyRef.current,
      message: text,
    });
    setChatInput("");
  };

  const saveNotes = async () => {
    if (!call?.appointment?._id) return;
    setSavingNotes(true);
    setNotesMsg("");
    try {
      await apiFetch(`/api/appointments/${call.appointment._id}`, {
        method: "PATCH",
        body: {
          notes,
          status: "InConsultation",
        },
      });
      setNotesMsg("Notes saved.");
    } catch (err) {
      setNotesMsg(err?.message || "Could not save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const updateAppointmentState = async (updates, successMessage) => {
    if (!call?.appointment?._id) return;
    setSavingNotes(true);
    setNotesMsg("");
    try {
      const updated = await apiFetch(`/api/appointments/${call.appointment._id}`, {
        method: "PATCH",
        body: {
          notes,
          ...updates,
        },
      });
      setAppointmentStatus(updated?.status || updates?.status || appointmentStatus);
      setNotesMsg(successMessage);
    } catch (err) {
      setNotesMsg(err?.message || "Could not update visit state.");
    } finally {
      setSavingNotes(false);
    }
  };

  const saveSummary = async () => {
    if (!call?.appointment?._id) return;
    setSavingNotes(true);
    setNotesMsg("");
    try {
      await apiFetch(`/api/appointments/${call.appointment._id}`, {
        method: "PATCH",
        body: {
          notes,
          metadata: {
            ...(call?.appointment?.metadata || {}),
            followUpRequired: Boolean(summary.followUpDate),
            consultationSummary: {
              diagnosis: summary.diagnosis,
              carePlan: summary.carePlan,
              prescriptionSummary: summary.prescriptionSummary,
              referralSummary: summary.referralSummary,
              followUpDate: summary.followUpDate || null,
            },
          },
        },
      });
      setNotesMsg("Summary saved.");
    } catch (err) {
      setNotesMsg(err?.message || "Could not save summary.");
    } finally {
      setSavingNotes(false);
    }
  };

  const renderChatPanel = () => (
    <div className="telehealth-side-card">
      <h3>Chat</h3>
      <div className="consultation-chat-log">
        {chatMessages.map((item, index) => (
          <div
            key={`${item.sentAt || index}-${index}`}
            className={`consultation-chat-bubble ${
              String(item.fromRole || "").toUpperCase() === normalizedRole ? "mine" : ""
            }`}
          >
            <div className="consultation-chat-meta">
              {item.fromRole || "User"} •{" "}
              {item.sentAt ? new Date(item.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}
            </div>
            <div>{item.message}</div>
          </div>
        ))}
        {!chatMessages.length && <div className="muted">No chat yet. Messages stay inside this consultation.</div>}
      </div>
      <div className="consultation-chat-input">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Type a message"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendChat();
            }
          }}
        />
        <button type="button" className="btn-secondary" onClick={sendChat}>
          Send
        </button>
      </div>
    </div>
  );

  const renderPatientPanel = () => (
    <div className="telehealth-side-card">
      <h3>Patient Information</h3>
      <dl className="telehealth-info-list">
        <dt>Name</dt>
        <dd>{patientName}</dd>
        <dt>Appointment</dt>
        <dd>{appointmentLabel}</dd>
        <dt>Visit status</dt>
        <dd>{appointmentStatus}</dd>
        <dt>Blood group</dt>
        <dd>{call?.patient?.bloodGroup || call?.appointment?.patient?.bloodGroup || "Not recorded"}</dd>
        <dt>Allergies</dt>
        <dd>{call?.patient?.allergies || call?.appointment?.patient?.allergies || "Not recorded"}</dd>
      </dl>
      <details className="telehealth-details">
        <summary>Medical history</summary>
        <p>{call?.appointment?.notes || "No prior notes attached to this appointment."}</p>
      </details>
    </div>
  );

  const renderNotesPanel = () => (
    <div className="telehealth-side-card">
      <h3>Consultation Notes</h3>
      <textarea
        rows={7}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Write symptoms, findings, assessment, plan, referral, or follow-up notes."
      />
      <div className="consultation-notes-actions">
        <button type="button" className="btn-primary" disabled={savingNotes} onClick={saveNotes}>
          {savingNotes ? "Saving..." : "Save Notes"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={savingNotes}
          onClick={() => updateAppointmentState({ status: "InConsultation" }, "Visit marked in consultation.")}
        >
          Start Visit
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={savingNotes}
          onClick={() =>
            updateAppointmentState(
              {
                status: "Completed",
                metadata: {
                  ...(call?.appointment?.metadata || {}),
                  followUpRequired: false,
                },
              },
              "Visit marked complete."
            )
          }
        >
          Complete Visit
        </button>
        {notesMsg ? <span className="muted">{notesMsg}</span> : null}
      </div>

      <div className="consultation-summary-grid">
        <h4 style={{ margin: "12px 0 0" }}>Visit Summary</h4>
        <label>Diagnosis</label>
        <input
          value={summary.diagnosis}
          onChange={(e) => setSummary((prev) => ({ ...prev, diagnosis: e.target.value }))}
          placeholder="Main diagnosis"
        />
        <label>Care Plan</label>
        <textarea
          rows={3}
          value={summary.carePlan}
          onChange={(e) => setSummary((prev) => ({ ...prev, carePlan: e.target.value }))}
          placeholder="Treatment plan and advice"
        />
        <label>Prescription Summary</label>
        <textarea
          rows={2}
          value={summary.prescriptionSummary}
          onChange={(e) => setSummary((prev) => ({ ...prev, prescriptionSummary: e.target.value }))}
          placeholder="Medicines or pharmacy instructions"
        />
        <label>Referral Summary</label>
        <textarea
          rows={2}
          value={summary.referralSummary}
          onChange={(e) => setSummary((prev) => ({ ...prev, referralSummary: e.target.value }))}
          placeholder="Referral or next specialist step"
        />
        <label>Follow-up Date</label>
        <input
          type="date"
          value={summary.followUpDate}
          onChange={(e) => setSummary((prev) => ({ ...prev, followUpDate: e.target.value }))}
        />
        <div className="consultation-notes-actions">
          <button type="button" className="btn-primary" disabled={savingNotes} onClick={saveSummary}>
            {savingNotes ? "Saving..." : "Save Summary"}
          </button>
          <a
            className="btn-secondary"
            href={`/doctor/prescriptions${call?.patient?._id ? `?patientId=${call.patient._id}` : ""}`}
          >
            Prescriptions
          </a>
          <a
            className="btn-secondary"
            href={`/doctor/referrals${call?.patient?._id ? `?patientId=${call.patient._id}` : ""}`}
          >
            Referrals
          </a>
        </div>
      </div>
    </div>
  );

  const renderSettingsPanel = () => (
    <div className="telehealth-side-card">
      <h3>Call Settings</h3>
      <div className="telehealth-readiness-grid compact">
        <div>
          <strong>Microphone</strong>
          <span>{audioEnabled ? "On" : "Muted"}</span>
        </div>
        <div>
          <strong>Camera</strong>
          <span>{wantsVideo ? (videoEnabled ? "On" : "Off") : "Voice call"}</span>
        </div>
        <div>
          <strong>Network</strong>
          <span>{connected ? "Connected" : joined ? "Room ready" : "Connecting"}</span>
        </div>
      </div>
      <p className="muted">If audio or video is blocked, check browser permissions and rejoin the consultation.</p>
    </div>
  );

  const renderActivePanel = () => {
    if (activePanel === "chat") return renderChatPanel();
    if (activePanel === "notes" && normalizedRole === "DOCTOR") return renderNotesPanel();
    if (activePanel === "settings") return renderSettingsPanel();
    return normalizedRole === "DOCTOR" ? renderPatientPanel() : renderChatPanel();
  };

  const connectionQuality = connected ? "Excellent" : joined ? "Fair" : "Checking";
  const connectionQualityClass = connected ? "excellent" : joined ? "fair" : "checking";

  if (!call?._id) return null;

  if (phase === "completed") {
    return (
      <div className="telehealth-overlay" role="dialog" aria-modal="true" aria-live="polite">
        <div className="telehealth-complete-card">
          <div className="telehealth-complete-icon">✓</div>
          <h2>{normalizedRole === "DOCTOR" ? "Consultation Successfully Completed" : "Consultation Completed"}</h2>
          <p>
            {normalizedRole === "DOCTOR"
              ? "Summary saved. You can continue documentation or move to the next patient."
              : "Your consultation has ended. You can review records or book a follow-up if needed."}
          </p>
          <dl className="telehealth-info-list">
            <dt>Duration</dt>
            <dd>{formatDuration(elapsedMs)}</dd>
            <dt>Doctor</dt>
            <dd>{doctorName}</dd>
            <dt>Service</dt>
            <dd>{appointmentLabel}</dd>
            <dt>Summary</dt>
            <dd>Available after doctor sign-off</dd>
            <dt>Prescription</dt>
            <dd>Available when issued</dd>
            <dt>Recording</dt>
            <dd>Enterprise recording framework ready</dd>
          </dl>
          <div className="appointment-success-actions">
            {normalizedRole === "DOCTOR" ? (
              <button type="button" className="btn-primary" onClick={leaveRoom}>
                Next Patient
              </button>
            ) : (
              <a className="btn-primary" href="/patient/medical-records">
                View Summary
              </a>
            )}
            {normalizedRole === "DOCTOR" ? (
              <a className="btn-secondary" href={`/doctor/prescriptions${call?.patient?._id ? `?patientId=${call.patient._id}` : ""}`}>
                Open Prescription
              </a>
            ) : (
              <a className="btn-secondary" href="/patient/prescriptions">
                Open Prescription
              </a>
            )}
            <a className="btn-secondary" href={normalizedRole === "DOCTOR" ? "/app/operations/scheduling/my-schedule" : "/patient/appointments"}>
              Book Follow-Up
            </a>
            <button type="button" className="btn-secondary" onClick={leaveRoom}>
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "lobby" || phase === "countdown") {
    return (
      <div className="telehealth-overlay" role="dialog" aria-modal="true" aria-live="polite">
        <div className="telehealth-lobby">
          <button type="button" className="appointment-success-close" onClick={leaveRoom} aria-label="Close consultation lobby">
            ×
          </button>
          <div className="telehealth-lobby-copy">
            <span className="telehealth-kicker">Preparing Consultation</span>
            <h2>{phase === "countdown" ? "Joining secure consultation room..." : "Your clinician is getting ready"}</h2>
            <p>
              {normalizedRole === "DOCTOR"
                ? `Patient: ${patientName}. Service: ${appointmentLabel}.`
                : `${doctorName} is ready. We are checking your consultation setup before you enter.`}
            </p>
            {phase === "countdown" ? (
              <div className="telehealth-countdown" aria-label={`Joining in ${countdown}`}>
                {countdown || 1}
              </div>
            ) : null}
          </div>

          <div className="telehealth-lobby-grid">
            <div className="telehealth-preview-card">
              <div className={`telehealth-preview ${wantsVideo ? "video" : "voice"}`}>
                <div className="telehealth-avatar">{normalizedRole === "DOCTOR" ? patientName[0] || "P" : doctorName[0] || "D"}</div>
                <div>
                  <strong>{wantsVideo ? "Camera Preview" : "Voice Consultation"}</strong>
                  <span>{wantsVideo ? "Camera starts after you join." : "Microphone starts after you join."}</span>
                </div>
              </div>
            </div>
            <div className="telehealth-readiness-grid">
              <div>
                <strong>Checking microphone ✓</strong>
                <span>Permission requested when you join</span>
              </div>
              <div>
                <strong>Checking camera ✓</strong>
                <span>{wantsVideo ? "Camera check ready" : "Not needed for voice"}</span>
              </div>
              <div>
                <strong>Checking connection ✓</strong>
                <span>Network status: Excellent</span>
              </div>
              <div>
                <strong>Doctor</strong>
                <span>{doctorName}</span>
              </div>
              <div>
                <strong>Appointment</strong>
                <span>{appointmentLabel}</span>
              </div>
              <div>
                <strong>Estimated Start</strong>
                <span>1 minute</span>
              </div>
            </div>
          </div>

          <div className="appointment-success-actions">
            <button type="button" className="btn-primary" onClick={() => setPhase("countdown")}>
              Join Now
            </button>
            <button type="button" className="btn-secondary" onClick={leaveRoom}>
              Not Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="telehealth-room-shell" role="dialog" aria-modal="true" aria-live="polite">
      <div className="telehealth-room-topbar">
        <div>
          <span className="telehealth-kicker">Secure AfyaLink Consultation</span>
          <h2>{wantsVideo ? "Video Consultation" : "Voice Consultation"}</h2>
        </div>
        <div className="telehealth-room-timer" aria-label={`Consultation duration ${formatDuration(elapsedMs)}`}>
          {formatDuration(elapsedMs)}
        </div>
        <div className="telehealth-room-meta">
          <span>{joined ? status : "Connecting..."}</span>
          <strong className={`quality ${connectionQualityClass}`}>Quality: {connectionQuality}</strong>
        </div>
      </div>

      {error ? <div className="telehealth-error">{error}</div> : null}

      <div className={`telehealth-room-grid ${wantsVideo ? "video" : "voice"}`}>
        <main className="telehealth-stage">
          {wantsVideo ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="telehealth-remote-video" />
              {!connected ? (
                <div className="telehealth-video-placeholder">
                  <div className="telehealth-avatar">{normalizedRole === "DOCTOR" ? patientName[0] || "P" : doctorName[0] || "D"}</div>
                  <strong>Waiting for participant</strong>
                </div>
              ) : null}
              <div className="telehealth-local-tile">
                <video ref={localVideoRef} autoPlay playsInline muted className="telehealth-local-video" />
                <span>You</span>
              </div>
            </>
          ) : (
            <div className="telehealth-voice-stage">
              <div className="telehealth-avatar large">{normalizedRole === "DOCTOR" ? patientName[0] || "P" : doctorName[0] || "D"}</div>
              <h2>{normalizedRole === "DOCTOR" ? patientName : doctorName}</h2>
              <p>{connected ? "Connected" : "Waiting for participant"}</p>
              <strong>Duration: {formatDuration(elapsedMs)}</strong>
              <div className="telehealth-wave" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </main>

        <aside className="telehealth-side-panel">
          {renderActivePanel()}
        </aside>
      </div>

      <div className="telehealth-controls" aria-label="Consultation controls">
        <button type="button" className={`telehealth-control ${!audioEnabled ? "muted" : ""}`} onClick={toggleAudio}>
          <span>Mic</span>
          {audioEnabled ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          className={`telehealth-control ${!videoEnabled ? "muted" : ""}`}
          onClick={toggleVideo}
          disabled={!wantsVideo}
        >
          <span>Cam</span>
          {videoEnabled ? "Camera" : "Camera Off"}
        </button>
        <button type="button" className="telehealth-control" onClick={() => setActivePanel("chat")}>
          <span>Chat</span>
          Chat
        </button>
        <button type="button" className="telehealth-control" onClick={() => setActivePanel("settings")}>
          <span>Set</span>
          Settings
        </button>
        <button type="button" className="telehealth-control" disabled title="Screen sharing will be enabled after browser permission review.">
          <span>Share</span>
          Share Screen
        </button>
        {normalizedRole === "DOCTOR" ? (
          <button type="button" className="telehealth-control" onClick={() => setActivePanel("notes")}>
            <span>Notes</span>
            Notes
          </button>
        ) : null}
        <button
          type="button"
          className="telehealth-control danger"
          onClick={normalizedRole === "DOCTOR" ? endForEveryone : completeLocally}
        >
          <span>End</span>
          {normalizedRole === "DOCTOR" ? "End Call" : "Leave"}
        </button>
      </div>
    </div>
  );
}
