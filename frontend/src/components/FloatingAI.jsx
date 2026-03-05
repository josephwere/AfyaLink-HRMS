import React, { useEffect, useMemo, useState } from "react";
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

export default function FloatingAI() {
  const { settings } = useSystemSettings();
  const ai = settings?.ai;

  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [busy, setBusy] = useState(false);
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

  const aiName = ai?.name || "NeuroEdge";
  const greeting = ai?.greeting || "Ask AI";

  useEffect(() => {
    if (!open) return;
    setBusy(true);
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
      .finally(() => setBusy(false));
  }, [open]);

  const reminderText = useMemo(() => {
    const appt = context?.nextAppointment?.scheduledAt;
    if (!appt) return "No upcoming appointment.";
    return `Next appointment: ${new Date(appt).toLocaleString()}`;
  }, [context]);

  if (!ai?.enabled) return null;

  const runAdvice = async () => {
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        symptoms: parseCsv(symptoms),
        vitals: {
          temperatureC: temperatureC ? Number(temperatureC) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
        },
      };
      const out = await getAssistantAdvice(payload);
      setAdvice(out?.advice || null);
    } catch (err) {
      setMsg(err?.message || "Unable to get assistant advice");
    } finally {
      setBusy(false);
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
    setBusy(true);
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
      setBusy(false);
    }
  };

  const summarizePage = async () => {
    setBusy(true);
    setMsg("");
    try {
      const pageContext = String(document?.body?.innerText || "").slice(0, 8000);
      const out = await summarizeAssistantPage({ pageContext });
      setChatAnswer(out?.summary || "");
    } catch (err) {
      setMsg(err?.message || "Failed to summarize page");
    } finally {
      setBusy(false);
    }
  };

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
          <aside className="ai-panel" role="dialog" aria-label={`${aiName} assistant`}>
            <div className="ai-panel-head">
              <div>
                <h3>{aiName} Personal Assistant</h3>
                <p className="muted">{reminderText}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="ai-panel-body">
              {busy && <p className="muted">Loading...</p>}
              {msg && <div className="auth-info">{msg}</div>}

              <div className="card form">
                <label>Symptoms (comma-separated)</label>
                <input
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="fever, cough, headache"
                />
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
                <button type="button" className="btn-primary" onClick={runAdvice} disabled={busy}>
                  {busy ? "Analyzing..." : "Get Personal Advice"}
                </button>
              </div>

              {advice && (
                <div className="card">
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
                <div className="row-actions">
                  <button type="button" className="btn-primary" onClick={askAssistant} disabled={busy || !chatPrompt.trim()}>
                    {busy ? "Thinking..." : "Ask AI"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={summarizePage} disabled={busy}>
                    Summarize This Page
                  </button>
                </div>
                {chatAnswer && (
                  <div className="card">
                    <h4>Assistant Response</h4>
                    <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{chatAnswer}</p>
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
                <label>Medication reminders</label>
                <input
                  value={medicationsInput}
                  onChange={(e) => setMedicationsInput(e.target.value)}
                  placeholder="Paracetamol | 500mg | 8 hourly, Insulin | 10 units | morning"
                />
                <label>Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
