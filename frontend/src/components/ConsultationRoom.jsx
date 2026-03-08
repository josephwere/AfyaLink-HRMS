import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../utils/socket.jsx";
import apiFetch from "../utils/apiFetch";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function ConsultationRoom({
  call,
  role = "PATIENT",
  onClose,
  onEnded,
}) {
  const socket = useSocket();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const roomKeyRef = useRef("");

  const [status, setStatus] = useState("Preparing room...");
  const [error, setError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(String(call?.callType || "").toUpperCase() === "VIDEO");
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [notes, setNotes] = useState(call?.appointment?.notes || "");
  const [notesMsg, setNotesMsg] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState(call?.appointment?.status || "Scheduled");
  const [summary, setSummary] = useState(() => ({
    diagnosis: call?.appointment?.metadata?.consultationSummary?.diagnosis || "",
    carePlan: call?.appointment?.metadata?.consultationSummary?.carePlan || "",
    prescriptionSummary: call?.appointment?.metadata?.consultationSummary?.prescriptionSummary || "",
    referralSummary: call?.appointment?.metadata?.consultationSummary?.referralSummary || "",
    followUpDate: call?.appointment?.metadata?.consultationSummary?.followUpDate
      ? String(call.appointment.metadata.consultationSummary.followUpDate).slice(0, 10)
      : "",
  }));

  const wantsVideo = useMemo(
    () => String(call?.callType || "").toUpperCase() === "VIDEO",
    [call?.callType]
  );

  useEffect(() => {
    setVideoEnabled(wantsVideo);
  }, [wantsVideo]);

  useEffect(() => {
    if (!socket || !call?._id) return undefined;
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
            ? "Camera or microphone access was denied."
            : "Microphone access was denied."
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
        setError("Could not start the consultation room.");
      }
    };

    const handleJoined = ({ roomKey }) => {
      roomKeyRef.current = roomKey;
      setJoined(true);
      setStatus("Room ready");
    };

    const handlePeerJoined = async () => {
      if (String(role).toUpperCase() !== "DOCTOR") return;
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
        setError("Consultation signaling failed.");
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
  }, [socket, call?._id, role, wantsVideo]);

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

  const endForEveryone = () => {
    if (typeof onEnded === "function") onEnded(call);
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

  return (
    <div className="card premium-card consultation-room-card">
      <div className="consultation-room-header">
        <div>
          <h3 style={{ margin: 0 }}>Consultation Room</h3>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {call?.callType === "VIDEO" ? "Video call" : "Voice call"} • {joined ? status : "Opening room..."}
          </p>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Visit status: {appointmentStatus}
          </p>
        </div>
        <div className="doctor-actions-row">
          <button type="button" className="btn-secondary" onClick={leaveRoom}>
            Close Room
          </button>
          {String(role).toUpperCase() === "DOCTOR" && (
            <button type="button" className="btn-primary" onClick={endForEveryone}>
              End Call
            </button>
          )}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

      <div className={`consultation-stage ${wantsVideo ? "video" : "voice"}`}>
        <div className="consultation-stream-card">
          {wantsVideo ? (
            <video ref={localVideoRef} autoPlay playsInline muted className="consultation-video local" />
          ) : (
            <div className="consultation-audio-state">Your microphone is {audioEnabled ? "on" : "off"}.</div>
          )}
          <div className="consultation-stream-label">You</div>
        </div>
        <div className="consultation-stream-card">
          {wantsVideo ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="consultation-video remote" />
          ) : (
            <div className="consultation-audio-state">
              {connected ? "The other person is connected." : "Waiting for the other person."}
            </div>
          )}
          <div className="consultation-stream-label">Remote</div>
        </div>
      </div>

      <div className="consultation-toolbar">
        <button type="button" className="btn-secondary" onClick={toggleAudio}>
          {audioEnabled ? "Mute Mic" : "Unmute Mic"}
        </button>
        {wantsVideo && (
          <button type="button" className="btn-secondary" onClick={toggleVideo}>
            {videoEnabled ? "Turn Camera Off" : "Turn Camera On"}
          </button>
        )}
        <div className={`action-pill ${connected ? "connected" : ""}`}>
          {connected ? "Live" : "Waiting"}
        </div>
      </div>

      <div className="consultation-side-grid">
        <div className="consultation-chat-card">
          <h4 style={{ marginTop: 0 }}>Chat</h4>
          <div className="consultation-chat-log">
            {chatMessages.map((item, index) => (
              <div
                key={`${item.sentAt || index}-${index}`}
                className={`consultation-chat-bubble ${
                  String(item.fromRole || "").toUpperCase() === String(role).toUpperCase() ? "mine" : ""
                }`}
              >
                <div className="consultation-chat-meta">
                  {item.fromRole || "User"} •{" "}
                  {item.sentAt ? new Date(item.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}
                </div>
                <div>{item.message}</div>
              </div>
            ))}
            {!chatMessages.length && <div className="muted">No chat yet.</div>}
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

        {String(role).toUpperCase() === "DOCTOR" && (
          <div className="consultation-chat-card">
            <h4 style={{ marginTop: 0 }}>Consultation Notes</h4>
            <textarea
              rows={9}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write key symptoms, findings, assessment, plan, referral, or follow-up notes."
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
                        followUpRequired: true,
                      },
                    },
                    "Follow-up marked."
                  )
                }
              >
                Mark Follow-up
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
                  Open Prescriptions
                </a>
                <a
                  className="btn-secondary"
                  href={`/doctor/referrals${call?.patient?._id ? `?patientId=${call.patient._id}` : ""}`}
                >
                  Open Referrals
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
