import React, { useRef, useState } from "react";
import { fetchApi } from "../lib/api/client";

export default function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRef.current = mediaRecorder;
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      try {
        const data = await fetchApi("/api/ai/transcribe", {
        method: "POST",
        body: fd,
        setTranscript(data.text || JSON.stringify(data));
      } catch {
        setTranscript("Transcription failed");
      }
    };
    mediaRecorder.start();
    setRecording(true);
  };

  const stop = () => {
    mediaRef.current && mediaRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="premium-card mini-voice-shell">
      <div className="card-header-actions">
        <div>
          <h3>Voice Recorder</h3>
          <p className="muted">Capture speech, transcribe it, and reuse the output in clinical workflows.</p>
        </div>
      </div>
      <div className="welcome-actions">
        <button type="button" className="btn-primary" onClick={start} disabled={recording}>
          {recording ? "Recording..." : "Start"}
        </button>
        <button type="button" className="btn-secondary" onClick={stop} disabled={!recording}>
          Stop
        </button>
      </div>
      <div className="mini-voice-transcript">
        <strong>Transcript</strong>
        <div>{transcript || "No transcript yet."}</div>
      </div>
    </div>
  );
}
