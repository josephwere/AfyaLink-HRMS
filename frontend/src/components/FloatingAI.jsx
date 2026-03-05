import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import {
  getAssistantAdvice,
  getAssistantContext,
  chatAssistant,
  summarizeAssistantPage,
  updateAssistantProfile,
} from "../services/assistantApi";

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default function FloatingAI() {
  const { settings } = useSystemSettings();
  const ai = settings?.ai;

  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [advice, setAdvice] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [spo2, setSpo2] = useState("");
  const [conditionsInput, setConditionsInput] = useState("");
  const [medicationsInput, setMedicationsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [dictationField, setDictationField] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  const recognitionRef = useRef(null);

  const aiName = ai?.name || "NeuroEdge";
  const greeting = ai?.greeting || "Ask AI";

  useEffect(() => {
    if (!open) return;
    setLoadingContext(true);
    setMsg("");
    getAssistantContext()
      .then((res) => {
        const ctx = res?.context || {};
        setContext(ctx);
        const profile = ctx.assistantProfile || {};
        setConditionsInput((profile.conditions || []).join(", "));
        setMedicationsInput(
          (profile.medications || [])
            .map((m) => [m.name, m.dosage, m.schedule].filter(Boolean).join(" | "))
            .join(", ")
        );
        setNotes(profile.notes || "");
      })
      .catch((err) => setMsg(err?.message || "Failed to load assistant context"))
      .finally(() => setLoadingContext(false));
  }, [open]);

  const reminderText = useMemo(() => {
    const appt = context?.nextAppointment?.scheduledAt;
    if (!appt) return "No upcoming appointment.";
    return `Next appointment: ${new Date(appt).toLocaleString()}`;
  }, [context]);

  const bmi = useMemo(() => {
    const h = parseNumber(heightCm);
    const w = parseNumber(weightKg);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const meters = h / 100;
    if (!meters) return null;
    const value = w / (meters * meters);
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(1));
  }, [heightCm, weightKg]);

  const hydrationHint = useMemo(() => {
    const w = parseNumber(weightKg);
    if (!w || w <= 0) return "Add weight to estimate daily water target.";
    const liters = Math.max(1.5, Math.min(4.5, (w * 0.033))).toFixed(1);
    return `Suggested water target: ~${liters} L/day`;
  }, [weightKg]);

  const supportsRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  if (!ai?.enabled) return null;

  const setFieldValue = (field, value) => {
    if (!value) return;
    if (field === "symptoms") setSymptoms((prev) => `${prev}${prev ? ", " : ""}${value}`.trim());
    if (field === "question") setChatPrompt((prev) => `${prev}${prev ? " " : ""}${value}`.trim());
    if (field === "conditions") setConditionsInput((prev) => `${prev}${prev ? ", " : ""}${value}`.trim());
    if (field === "medications") setMedicationsInput((prev) => `${prev}${prev ? ", " : ""}${value}`.trim());
    if (field === "notes") setNotes((prev) => `${prev}${prev ? " " : ""}${value}`.trim());
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsDictating(false);
    setDictationField("");
  };

  const startDictation = (field) => {
    setMsg("");
    if (!supportsRecognition) {
      setMsg("Voice dictation is not supported in this browser. Use Chrome/Edge for mic input.");
      return;
    }
    if (isDictating) stopDictation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setDictationField(field);
    setIsDictating(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((res) => (res?.[0]?.transcript || "").trim())
        .filter(Boolean)
        .join(" ");
      if (transcript) setFieldValue(field, transcript);
    };
    recognition.onerror = (event) => {
      setMsg(event?.error ? `Voice input error: ${event.error}` : "Voice input failed");
      stopDictation();
    };
    recognition.onend = () => {
      stopDictation();
    };
    recognition.start();
  };

  const readAloud = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setMsg("Text-to-speech not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text || "").slice(0, 4000));
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeakerOn(true);
    utterance.onend = () => setSpeakerOn(false);
    utterance.onerror = () => setSpeakerOn(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakerOn(false);
  };

  const runAdvice = async () => {
    setAdviceBusy(true);
    setMsg("");
    try {
      const payload = {
        symptoms: parseCsv(symptoms),
        vitals: {
          temperatureC: parseNumber(temperatureC),
          spo2: parseNumber(spo2),
        },
      };
      const out = await getAssistantAdvice(payload);
      setAdvice(out?.advice || null);
    } catch (err) {
      setMsg(err?.message || "Unable to get assistant advice");
    } finally {
      setAdviceBusy(false);
    }
  };

  const saveProfile = async () => {
    setSaveBusy(true);
    setMsg("");
    try {
      const medications = parseCsv(medicationsInput).map((row) => {
        const [name, dosage, schedule] = row.split("|").map((v) => String(v || "").trim());
        return { name, dosage, schedule };
      });
      await updateAssistantProfile({
        conditions: parseCsv(conditionsInput),
        medications,
        notes,
      });
      setMsg("Assistant profile saved. Advice will now use this health context.");
    } catch (err) {
      setMsg(err?.message || "Failed to save assistant profile");
    } finally {
      setSaveBusy(false);
    }
  };

  const askAssistant = async () => {
    setChatBusy(true);
    setMsg("");
    try {
      const pageContext = String(document?.body?.innerText || "").slice(0, 8000);
      const out = await chatAssistant({
        message: chatPrompt,
        pageContext,
      });
      setChatAnswer(out?.answer || "");
    } catch (err) {
      setMsg(err?.message || "Failed to get assistant answer");
    } finally {
      setChatBusy(false);
    }
  };

  const summarizePage = async () => {
    setSummaryBusy(true);
    setMsg("");
    try {
      const pageContext = String(document?.body?.innerText || "").slice(0, 8000);
      const out = await summarizeAssistantPage({ pageContext });
      setChatAnswer(out?.summary || "");
    } catch (err) {
      setMsg(err?.message || "Failed to summarize page");
    } finally {
      setSummaryBusy(false);
    }
  };

  const busy = loadingContext || adviceBusy || chatBusy || summaryBusy || saveBusy;

  return (
    <>
      <button
        type="button"
        className="ai-float"
        onClick={() => setOpen(true)}
        title={aiName}
      >
        <span className="ai-float-badge">{aiName}</span>
        <span className="ai-float-sub">{greeting}</span>
      </button>

      {open && (
        <>
          <button type="button" className="ai-panel-backdrop" onClick={() => setOpen(false)} />
          <aside className="ai-panel premium" role="dialog" aria-label={`${aiName} assistant`}>
            <div className="ai-panel-head">
              <div>
                <h3>{aiName} Personal Assistant</h3>
                <p className="muted">{reminderText}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
                ×
              </button>
            </div>

            <div className="ai-panel-body">
              {loadingContext && <p className="muted">Loading...</p>}
              {msg && <div className="auth-info">{msg}</div>}
              {isDictating && (
                <div className="card ai-status-card">
                  <strong>Mic is on:</strong> Listening for {dictationField}
                  <button type="button" className="btn-secondary" onClick={stopDictation}>
                    Stop Mic
                  </button>
                </div>
              )}
              {speakerOn && (
                <div className="card ai-status-card">
                  <strong>Audio is playing.</strong>
                  <button type="button" className="btn-secondary" onClick={stopSpeaking}>
                    Stop Audio
                  </button>
                </div>
              )}

              <div className="ai-health-grid">
                <div className="card ai-kpi">
                  <span className="muted">BMI</span>
                  <strong>{bmi || "—"}</strong>
                </div>
                <div className="card ai-kpi">
                  <span className="muted">Hydration</span>
                  <strong>{hydrationHint}</strong>
                </div>
                <div className="card ai-kpi">
                  <span className="muted">Vitals Risk</span>
                  <strong>
                    {(() => {
                      const t = parseNumber(temperatureC);
                      const o = parseNumber(spo2);
                      if ((o && o < 92) || (t && t >= 39)) return "High";
                      if ((o && o < 95) || (t && t >= 37.8)) return "Watch";
                      return "Stable";
                    })()}
                  </strong>
                </div>
              </div>

              <div className="card form">
                <label>Symptoms (comma-separated)</label>
                <input
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="fever, cough, headache"
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("symptoms")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Symptoms
                  </button>
                </div>
                <div className="row-actions">
                  <div>
                    <label>Temperature (C)</label>
                    <input value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} />
                  </div>
                  <div>
                    <label>SpO2 (%)</label>
                    <input value={spo2} onChange={(e) => setSpo2(e.target.value)} />
                  </div>
                </div>
                <div className="row-actions">
                  <div>
                    <label>Height (cm)</label>
                    <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" />
                  </div>
                  <div>
                    <label>Weight (kg)</label>
                    <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
                  </div>
                </div>
                <button type="button" className="btn-primary" onClick={runAdvice} disabled={busy}>
                  {adviceBusy ? "Analyzing..." : "Get Personal Advice"}
                </button>
              </div>

              {advice && (
                <div className="card ai-response-card">
                  <h4>Alerts</h4>
                  <ul>
                    {(advice.alerts || []).map((a, i) => (
                      <li key={`a-${i}`}>{a}</li>
                    ))}
                    {!advice.alerts?.length && <li>No critical alerts detected.</li>}
                  </ul>
                  <h4>Recommendations</h4>
                  <ul>
                    {(advice.recommendations || []).map((r, i) => (
                      <li key={`r-${i}`}>{r}</li>
                    ))}
                  </ul>
                  <p className="muted">{advice.disclaimer}</p>
                  <div className="ai-inline-actions">
                    <button type="button" className="btn-secondary" onClick={() => readAloud([...(advice.alerts || []), ...(advice.recommendations || [])].join(". "))}>
                      Audio: Read Advice
                    </button>
                  </div>
                </div>
              )}

              <div className="card form">
                <h4>Ask AI</h4>
                <label>Question</label>
                <textarea
                  rows={3}
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder="Ask anything about this page or your workflow..."
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("question")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Question
                  </button>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn-primary" onClick={askAssistant} disabled={busy || !chatPrompt.trim()}>
                    {chatBusy ? "Thinking..." : "Ask AI"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={summarizePage} disabled={busy}>
                    {summaryBusy ? "Summarizing..." : "Summarize This Page"}
                  </button>
                </div>
                {chatAnswer && (
                  <div className="card ai-response-card">
                    <h4>Assistant Response</h4>
                    <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{chatAnswer}</p>
                    <div className="ai-inline-actions">
                      <button type="button" className="btn-secondary" onClick={() => readAloud(chatAnswer)}>
                        Audio: Read Response
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card form">
                <h4>Health Profile for Better Advice</h4>
                <label>Known conditions (comma-separated)</label>
                <input
                  value={conditionsInput}
                  onChange={(e) => setConditionsInput(e.target.value)}
                  placeholder="asthma, diabetes"
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("conditions")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Conditions
                  </button>
                </div>
                <label>Medication reminders</label>
                <input
                  value={medicationsInput}
                  onChange={(e) => setMedicationsInput(e.target.value)}
                  placeholder="Paracetamol | 500mg | 8 hourly, Insulin | 10 units | morning"
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("medications")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Medications
                  </button>
                </div>
                <label>Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("notes")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Notes
                  </button>
                </div>
                <button type="button" className="btn-secondary" onClick={saveProfile} disabled={saveBusy}>
                  {saveBusy ? "Saving..." : "Save Assistant Profile"}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
