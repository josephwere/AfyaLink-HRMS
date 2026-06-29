import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import {
  publishPatientSelected,
  publishFormOpened,
  publishFieldFocused,
  publishFieldChanged,
  publishFormSubmitted,
} from "../../ai/neuroedgeEventHelpers";

const INITIAL_FORM = {
  temperature: "",
  pulse: "",
  systolicBP: "",
  diastolicBP: "",
  spo2: "",
  painScale: "",
  note: "",
};

export default function VitalsEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [msg, setMsg] = useState("");
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setEncounter(null);
      return;
    }
    apiFetch(`/api/patients/${patientId}`)
      .then((loadedPatient) => {
        setPatient(loadedPatient);
        publishPatientSelected(loadedPatient);
      })
      .catch(() => setPatient(null));
    apiFetch(`/api/encounters?patientId=${encodeURIComponent(patientId)}&limit=1`)
      .then((rows) => {
        const items = Array.isArray(rows) ? rows : [];
        setEncounter(items[0] || null);
      })
      .catch(() => setEncounter(null));
  }, [patientId]);

  useEffect(() => {
    publishFormOpened("Vitals Entry");
  }, []);

  const readinessLabel = (() => {
    if (!encounter?._id) return "No active visit";
    if (encounter?.closeout?.canClose) return "Transfer/Discharge Ready";
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Hold: ${missing}` : "Review clinician handoffs";
  })();
  const escalationLabel = (() => {
    const summary = encounter?.escalationSummary;
    if (!summary?.count) return "";
    if (summary.openCount > 0) return "Escalated • Awaiting response";
    return "Escalation resolved";
  })();

  function getFieldCounts(nextForm) {
    const values = Object.values(nextForm || {});
    const completed = values.filter((value) => value !== "" && value !== null && value !== undefined).length;
    const remaining = values.length - completed;
    return { completedFields: completed, remainingFields: remaining };
  }

  function updateField(key, value) {
    setForm((prev) => {
      const nextForm = { ...prev, [key]: value };
      const counts = getFieldCounts(nextForm);
      publishFieldChanged(counts.completedFields, counts.remainingFields);
      return nextForm;
    });
  }

  function saveDraft() {
    const patientName = patient
      ? [patient.firstName, patient.lastName].filter(Boolean).join(" ")
      : "selected patient";
    publishFormSubmitted("Vitals Entry", "draft");
    setMsg(`Vitals draft prepared for ${patientName || "patient"}.`);
  }

  async function escalateEncounter() {
    if (!encounter?._id) {
      setMsg("No active visit to escalate.");
      return;
    }
    try {
      setEscalating(true);
      const res = await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/nurse-escalation`, {
        method: "POST",
        body: {
          note: `Bedside vitals review requested for ${[patient?.firstName, patient?.lastName].filter(Boolean).join(" ") || "patient"}.`,
        },
      });
      setMsg(`Escalation sent to ${res?.recipients || 0} recipient(s).`);
    } catch (e) {
      setMsg(e?.message || "Failed to send escalation.");
    } finally {
      setEscalating(false);
    }
  }

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Vitals Entry</h2>
          <p className="muted">Record patient vitals and flag abnormal trends for review.</p>
        </div>
        <div className="welcome-actions">
          {patientId ? (
            <button type="button" className="btn-secondary" onClick={() => navigate(`/nurse/patients?patientId=${patientId}`)}>
              Back To Patient
            </button>
          ) : null}
          <button type="button" className="btn-primary" onClick={saveDraft}>Save Draft</button>
          {encounter?.closeout?.canClose === false ? (
            <button type="button" className="btn-secondary" onClick={escalateEncounter} disabled={escalating}>
              {escalating ? "Escalating..." : "Escalate To Clinician"}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={() => navigate("/analytics")}>Trend View</button>
        </div>
      </div>

      {patient ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <div>
                <h3>Patient Context</h3>
                <p className="muted">
                  {[patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
                  {patient.nationalId ? ` • ${patient.nationalId}` : ""}
                </p>
              </div>
              <div className="action-pill">Ward: {patient.ward || "-"}</div>
            </div>
            <div className="alert-stack" style={{ marginTop: 10 }}>
              <div className="action-pill">{readinessLabel}</div>
              {escalationLabel ? <div className="action-pill warning">{escalationLabel}</div> : null}
              {encounter?.escalationSummary?.openCount === 0 && encounter?.escalationSummary?.resolvedAt ? (
                <div className="muted">
                  Resolved by {encounter?.escalationSummary?.resolvedBy?.name || "clinician"} on{" "}
                  {new Date(encounter.escalationSummary.resolvedAt).toLocaleString()}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Vitals Form</h3>
          <div className="grid" style={{ gap: 12 }}>
            <label>
              Temperature (C)
              <input value={form.temperature} onChange={(e) => updateField("temperature", e.target.value)} placeholder="36.8" />
            </label>
            <label>
              Pulse
              <input value={form.pulse} onChange={(e) => updateField("pulse", e.target.value)} placeholder="78" />
            </label>
            <label>
              Systolic BP
              <input value={form.systolicBP} onChange={(e) => updateField("systolicBP", e.target.value)} placeholder="120" />
            </label>
            <label>
              Diastolic BP
              <input value={form.diastolicBP} onChange={(e) => updateField("diastolicBP", e.target.value)} placeholder="80" />
            </label>
            <label>
              SpO2 (%)
              <input value={form.spo2} onChange={(e) => updateField("spo2", e.target.value)} placeholder="98" />
            </label>
            <label>
              Pain Scale
              <input value={form.painScale} onChange={(e) => updateField("painScale", e.target.value)} placeholder="0-10" />
            </label>
            <label>
              Nursing Note
              <textarea rows={4} value={form.note} onChange={(e) => updateField("note", e.target.value)} placeholder="Add bedside observation" />
            </label>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Quick Guidance</h3>
          <div className="alert-stack">
            <div className="action-pill">SpO2 below 95% should be reviewed fast.</div>
            <div className="action-pill">Abnormal temperature should be escalated to clinician.</div>
            <div className="action-pill">Use pain score with medication and nurse note together.</div>
            {encounter?.closeout?.canClose === false ? (
              <div className="action-pill warning">Discharge/transfer should wait until clinician handoffs are complete. Use escalation to alert the clinician.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
