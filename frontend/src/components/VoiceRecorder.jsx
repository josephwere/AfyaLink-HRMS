
import React, { useState, useRef } from 'react';
export default function VoiceRecorder(){
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async ()=>{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRef.current = mediaRecorder;
    chunksRef.current = [];
    mediaRecorder.ondataavailable = e => chunksRef.current.push(e.data);
    mediaRecorder.onstop = async ()=>{
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      const res = await fetch(`import.meta.env.VITE_API_URL}'}/api/ai/transcribe', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.text || JSON.stringify(data));
      } else {
        setTranscript('Transcription failed');
      }
    };
    mediaRecorder.start();
    setRecording(true);
  };

  const stop = ()=>{
    mediaRef.current && mediaRef.current.stop();
    setRecording(false);
  };

  return (<div style={{padding:8,border:'1px solid #ddd',borderRadius:8}}>
    <div><button onClick={start} disabled={recording}>Start</button> <button onClick={stop} disabled={!recording}>Stop</button></div>
    <div style={{marginTop:8}}><b>Transcript:</b><div>{transcript}</div></div>
  </div>);
}
