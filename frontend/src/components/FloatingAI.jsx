import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAuth } from "../utils/auth";
import {
  getAssistantAdvice,
  getAssistantContext,
  chatAssistant,
  summarizeAssistantPage,
  updateAssistantProfile,
  clearAssistantMemory,
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const ai = settings?.ai;

  const [open, setOpen] = useState(true);
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
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("70");
  const [dictationField, setDictationField] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [history, setHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatExpanded, setChatExpanded] = useState(true);

  const recognitionRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatSectionRef = useRef(null);

  const aiName = ai?.name || "NeuroEdge";
  const greeting = ai?.greeting || "Assistant";

  const role = String(user?.role || "").toUpperCase();
  const isPatient = role === "PATIENT";
  const isGuest = role === "GUEST";
  const aiAccess = settings?.monetization?.featureAccess?.ai || "FREE";
  const aiEnabled = ai?.enabled !== false;
  const adminRoles = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"];
  const canUseAI = aiEnabled && (aiAccess !== "PREMIUM" || isPatient || isGuest || adminRoles.includes(role));
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if ((isPatient || isGuest) && !autoOpenedRef.current) {
      setOpen(true);
      autoOpenedRef.current = true;
    }
  }, [isPatient, isGuest]);

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
        const memory = Array.isArray(ctx.chatHistory) ? ctx.chatHistory : [];
        setChatMessages(
          memory
            .filter((entry) => entry?.text)
            .map((entry) => ({
              id: entry.id || `${entry.role || "assistant"}-${entry.createdAt || Date.now()}`,
              role: entry.role === "user" ? "user" : "assistant",
              text: entry.text,
              createdAt: entry.createdAt || new Date().toISOString(),
            }))
        );
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

  const hydrationLiters = useMemo(() => {
    const w = parseNumber(weightKg);
    if (!w || w <= 0) return null;
    return Number(Math.max(1.5, Math.min(4.5, w * 0.033)).toFixed(1));
  }, [weightKg]);

  const bmiStatus = useMemo(() => {
    if (!bmi) return { label: "—", tone: "neutral", percent: 0, tip: "BMI will appear after height and weight are filled." };
    if (bmi < 18.5) return { label: "Low", tone: "caution", percent: 35, tip: "BMI is below the normal range." };
    if (bmi <= 24.9) return { label: "Normal", tone: "ok", percent: 68, tip: "BMI is in the normal range." };
    if (bmi <= 29.9) return { label: "High", tone: "caution", percent: 82, tip: "BMI is above the normal range." };
    return { label: "Critical", tone: "risk", percent: 100, tip: "BMI is well above the normal range." };
  }, [bmi]);

  const vitalsRisk = useMemo(() => {
    const t = parseNumber(temperatureC);
    const o = parseNumber(spo2);
    if ((o && o < 92) || (t && t >= 39)) {
      return { label: "Critical", tone: "risk", percent: 100, tip: "Low oxygen or high fever needs urgent review." };
    }
    if ((o && o < 95) || (t && t >= 37.8)) {
      return { label: "Caution", tone: "caution", percent: 68, tip: "Vitals are outside the normal range." };
    }
    return { label: "Stable", tone: "ok", percent: 36, tip: "Current vitals look stable." };
  }, [temperatureC, spo2]);

  const hydrationStatus = useMemo(() => {
    if (!hydrationLiters) {
      return { label: "—", tone: "neutral", percent: 0, tip: "Add weight to estimate daily water intake." };
    }
    const percent = Math.min(100, Math.round((hydrationLiters / 4.5) * 100));
    return { label: `${hydrationLiters} L/day`, tone: "ok", percent, tip: "Daily water estimate based on body weight." };
  }, [hydrationLiters]);

  const contextTip = useMemo(() => {
    if (!bmi) return "Enter your height and weight to unlock BMI and hydration guidance.";
    if (vitalsRisk.label === "Critical") return "Your vitals suggest urgent attention. Contact a clinician now.";
    if (bmiStatus.label === "Normal") return "Your BMI is in normal range. Maintain your current weight and hydration.";
    if (bmiStatus.label === "Low") return "Your BMI is below normal. Consider a clinician review if weight loss is unplanned.";
    if (bmiStatus.label === "High") return "Your BMI is above normal. Review nutrition, activity, and follow-up advice.";
    return "Use symptoms, vitals, and profile details together for better AI guidance.";
  }, [bmi, bmiStatus.label, vitalsRisk.label]);

  const appointmentPath = useMemo(() => {
    if (role === "PATIENT") return "/patient/appointments";
    if (role === "DOCTOR") return "/doctor/appointments";
    if (role === "RECEPTIONIST") return "/receptionist/booking-desk";
    return "/notifications";
  }, [role]);

  const calendarPath = useMemo(() => {
    if (role === "PATIENT") return "/patient";
    if (role === "DOCTOR") return "/doctor/schedule";
    if (role === "RECEPTIONIST") return "/receptionist/booking-desk";
    return "/profile";
  }, [role]);

  const supportsRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const openChat = () => {
    if (!chatExpanded) {
      setChatExpanded(true);
      return;
    }
    if (chatSectionRef.current) {
      chatSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (chatInputRef.current) {
      chatInputRef.current.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    if (!chatExpanded) return;
    if (typeof window === "undefined") return;
    const raf = window.requestAnimationFrame(() => {
      if (chatSectionRef.current) {
        chatSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (chatInputRef.current) {
        chatInputRef.current.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [chatExpanded]);

  if (!canUseAI) return null;

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

  const pushHistory = (kind, title, content) => {
    const text = String(content || "").trim();
    if (!text) return;
    setHistory((prev) => [
      { id: `${kind}-${Date.now()}`, kind, title, content: text, createdAt: new Date().toISOString() },
      ...prev,
    ].slice(0, 12));
  };

  const appendChatMessage = (role, text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    setChatMessages((prev) => [
      ...prev,
      { id: `${role}-${Date.now()}`, role, text: clean, createdAt: new Date().toISOString() },
    ].slice(-30));
  };

  const buildChatContext = (messages) => {
    const recent = (messages || []).slice(-6).map((entry) => {
      const label = entry.role === "user" ? "User" : "Assistant";
      return `${label}: ${entry.text}`;
    });

    const adviceLines = [
      ...(advice?.alerts || []),
      ...(advice?.recommendations || []),
    ].filter(Boolean);

    return [
      "Use the following health context to answer the user's question.",
      `Upcoming appointment: ${reminderText}`,
      `Symptoms: ${symptoms || "none reported"}`,
      `Vitals: Temp ${temperatureC || "—"}°C, SpO2 ${spo2 || "—"}%, BMI ${bmi ?? "—"}, Hydration target ${hydrationLiters ? `${hydrationLiters} L/day` : "—"}`,
      adviceLines.length ? `Recent advice: ${adviceLines.join("; ")}` : "",
      recent.length ? `Recent chat:\n${recent.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
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
      pushHistory(
        "advice",
        "Personal Advice",
        [
          ...(out?.advice?.alerts || []),
          ...(out?.advice?.recommendations || []),
          out?.advice?.disclaimer || "",
        ]
          .filter(Boolean)
          .join("\n")
      );
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
    const prompt = String(chatPrompt || "").trim();
    if (!prompt) return;
    appendChatMessage("user", prompt);
    setChatBusy(true);
    setMsg("");
    try {
      const pageContext = String(document?.body?.innerText || "").slice(0, 8000);
      const contextHint = buildChatContext([...chatMessages, { role: "user", text: prompt }]);
      const out = await chatAssistant({
        message: `${contextHint}\n\nUser question: ${prompt}`,
        userMessage: prompt,
        pageContext,
      });
      const answer = out?.answer || "";
      setChatAnswer(answer);
      appendChatMessage("assistant", answer);
      pushHistory("chat", prompt || "Ask AI", answer);
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
      appendChatMessage("assistant", out?.summary || "");
      pushHistory("summary", "Page Summary", out?.summary || "");
    } catch (err) {
      setMsg(err?.message || "Failed to summarize page");
    } finally {
      setSummaryBusy(false);
    }
  };

  const clearMemory = async () => {
    setMsg("");
    try {
      await clearAssistantMemory();
      setChatMessages([]);
      setChatAnswer("");
      setHistory([]);
      setMsg("Assistant memory cleared for this hospital.");
    } catch (err) {
      setMsg(err?.message || "Failed to clear assistant memory.");
    }
  };

  const busy = loadingContext || adviceBusy || chatBusy || summaryBusy || saveBusy;

  const exportHealthReport = () => {
    if (typeof window === "undefined") return;
    const report = `
${aiName} Personal Assistant
Status: ${reminderText}

BMI: ${bmi || "—"}
Hydration: ${hydrationStatus.label}
Vitals Risk: ${vitalsRisk.label}

Symptoms: ${symptoms || "—"}
Temperature: ${temperatureC || "—"}
SpO2: ${spo2 || "—"}
Height: ${heightCm || "170"}
Weight: ${weightKg || "70"}

Conditions: ${conditionsInput || "—"}
Medications: ${medicationsInput || "—"}
Notes: ${notes || "—"}

Latest Output:
${chatAnswer || advice?.recommendations?.join("; ") || "—"}
`.trim();
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      setMsg("Pop-up blocked. Allow pop-ups to export the report as PDF.");
      return;
    }
    popup.document.write(`<pre style="font:14px/1.6 system-ui;padding:24px;white-space:pre-wrap;">${report}</pre>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const copySummary = async () => {
    const text = chatAnswer || history[0]?.content || advice?.recommendations?.join("\n") || "";
    if (!text) {
      setMsg("Nothing to copy yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Summary copied.");
    } catch {
      setMsg("Could not copy summary.");
    }
  };

  return (
    <>
      <button
        type="button"
        className="ai-float"
        onClick={() => setOpen((prev) => !prev)}
        title={aiName}
      >
        <span className="ai-float-badge">{aiName}</span>
        <span className="ai-float-sub">{open ? "Hide" : greeting}</span>
      </button>

      {open && (
        <>
          <aside className="ai-panel premium" role="dialog" aria-label={`${aiName} assistant`}>
            <div className="ai-panel-head">
              <div className="ai-header-main">
                <div>
                  <h3>{aiName} Personal Assistant</h3>
                  <p className="muted">{reminderText}</p>
                </div>
                <div className="ai-header-actions">
                  <button type="button" className="btn-secondary" onClick={() => navigate(appointmentPath)}>
                    Add Appointment
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => navigate(calendarPath)}>
                    View Calendar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={openChat}
                  >
                    Ask
                  </button>
                  <button type="button" className="icon-btn" onClick={() => navigate("/profile")} aria-label="Assistant settings">
                    ⚙
                  </button>
                </div>
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
                <div className={`card ai-kpi ai-kpi-${bmiStatus.tone}`} title={bmiStatus.tip}>
                  <span className="muted">⚖ BMI</span>
                  <strong>{bmi || "—"}</strong>
                  <small>{bmiStatus.label}</small>
                  <div className="ai-progress"><span style={{ width: `${bmiStatus.percent}%` }} /></div>
                </div>
                <div className={`card ai-kpi ai-kpi-${hydrationStatus.tone}`} title={hydrationStatus.tip}>
                  <span className="muted">💧 Hydration</span>
                  <strong>{hydrationStatus.label}</strong>
                  <small>{hydrationHint}</small>
                  <div className="ai-progress"><span style={{ width: `${hydrationStatus.percent}%` }} /></div>
                </div>
                <div className={`card ai-kpi ai-kpi-${vitalsRisk.tone}`} title={vitalsRisk.tip}>
                  <span className="muted">❤ Vitals Risk</span>
                  <strong>{vitalsRisk.label}</strong>
                  <small>{vitalsRisk.tip}</small>
                  <div className="ai-progress"><span style={{ width: `${vitalsRisk.percent}%` }} /></div>
                </div>
              </div>

              <div className="card ai-tip-card">
                <strong>AI Tip</strong>
                <p className="muted">{contextTip}</p>
              </div>

              <div className="card form">
                <label>Symptoms (comma-separated)</label>
                <input
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="fever, cough, headache"
                  title="Use commas to separate symptoms or use voice input."
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("symptoms")} disabled={!supportsRecognition || busy}>
                    🎤 Fill Symptoms
                  </button>
                </div>
                <div className="row-actions">
                  <div>
                    <label title="Normal adult temperature is about 36.1°C to 37.2°C.">Temperature (°C)</label>
                    <input value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} placeholder="36.8" />
                  </div>
                  <div>
                    <label title="Normal SpO2 is usually 95% to 100%.">SpO2 (%)</label>
                    <input value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="98" />
                  </div>
                </div>
                <div className="row-actions">
                  <div>
                    <label title="Used for BMI calculation.">Height (cm)</label>
                    <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" />
                  </div>
                  <div>
                    <label title="Used for BMI and hydration guidance.">Weight (kg)</label>
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

              <div className="card form" ref={chatSectionRef}>
                <div className="ai-compact-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={openChat}
                  >
                    Ask
                  </button>
                  <button type="button" className="btn-secondary btn-compact" onClick={summarizePage} disabled={busy}>
                    {summaryBusy ? "..." : "Summary"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={copySummary}
                    disabled={!chatAnswer && !history.length && !advice}
                  >
                    Copy
                  </button>
                  <button type="button" className="btn-secondary btn-compact" onClick={exportHealthReport}>
                    PDF
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={clearMemory}
                    disabled={!chatMessages.length}
                  >
                    Clear Memory
                  </button>
                </div>
                {chatExpanded ? (
                  <>
                    <label>Question</label>
                    <textarea
                      className="ai-chat-input"
                      ref={chatInputRef}
                      rows={3}
                      value={chatPrompt}
                      onChange={(e) => setChatPrompt(e.target.value)}
                      placeholder="Ask anything about your health or this page..."
                    />
                    <div className="ai-inline-actions">
                      <button type="button" className="btn-secondary btn-compact" onClick={() => startDictation("question")} disabled={!supportsRecognition || busy}>
                        🎤 Fill Question
                      </button>
                      <button type="button" className="btn-primary btn-compact" onClick={askAssistant} disabled={busy || !chatPrompt.trim()}>
                        {chatBusy ? "Thinking..." : "Send"}
                      </button>
                    </div>
                  </>
                ) : null}
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
                <div className="card ai-history-card">
                  <h4>Chat History</h4>
                  <div className="ai-history-list">
                    {chatMessages.map((entry) => (
                      <div key={entry.id} className="ai-history-item ai-history-chat">
                        <strong>{entry.role === "user" ? "You" : "Assistant"}</strong>
                        <p>{entry.text}</p>
                        <small>{new Date(entry.createdAt).toLocaleTimeString()}</small>
                      </div>
                    ))}
                    {!chatMessages.length ? (
                      <p className="muted">Your chat messages will appear here for this session.</p>
                    ) : null}
                  </div>
                </div>
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
