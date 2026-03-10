import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { requestTransfer } from "../../services/transferApi";

const INITIAL_FORM = {
  diagnosis: "",
  diagnosisCode: "",
  symptoms: "",
  assessment: "",
  treatmentPlan: "",
  followUp: "",
  labTests: "",
  billingItems: "",
};

const CONSENT_SCOPES = ["demographics", "encounters", "labs", "prescriptions", "reports"];
const DEFAULT_SCOPES = ["demographics", "encounters", "labs", "prescriptions"];

export default function OPDWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const focus = String(searchParams.get("focus") || "").toUpperCase();
  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [msg, setMsg] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [resolvingEscalation, setResolvingEscalation] = useState(false);
  const [transferHospitals, setTransferHospitals] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({
    toHospitalId: "",
    reasons: "",
    handoverSummary: "",
    scopes: DEFAULT_SCOPES,
  });

  const closeoutStatus = {
    visit: encounter?._id ? "READY" : "MISSING",
    diagnosis:
      encounter?.closeout?.requirements?.diagnosis
        ? encounter?.closeout?.missingRequirements?.includes("DIAGNOSIS")
          ? "MISSING"
          : "DONE"
        : "OPTIONAL",
    billing:
      encounter?.closeout?.requirements?.billing
        ? encounter?.closeout?.missingRequirements?.includes("BILLING")
          ? "MISSING"
          : "DONE"
        : "OPTIONAL",
    prescriptions:
      encounter?.closeout?.requirements?.prescription
        ? encounter?.closeout?.missingRequirements?.includes("PRESCRIPTION")
          ? "MISSING"
          : "DONE"
        : "OPTIONAL",
  };
  const resolvedPolicy = encounter?.closeout?.policy || null;
  const escalationSummary = encounter?.escalationSummary || null;
  const focusLabel =
    focus === "DIAGNOSIS"
      ? "Send Diagnosis & Labs"
      : focus === "BILLING"
      ? "Send Billing"
      : focus === "PRESCRIPTION"
      ? "Open Prescribe"
      : "";

  async function refreshEncounter(targetPatientId = patientId) {
    if (!targetPatientId) {
      setEncounter(null);
      return;
    }
    try {
      const rows = await apiFetch(`/api/encounters?patientId=${encodeURIComponent(targetPatientId)}&limit=1`);
      const items = Array.isArray(rows) ? rows : [];
      setEncounter(items[0] || null);
    } catch {
      setEncounter(null);
    }
  }

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setEncounter(null);
      return;
    }
    apiFetch(`/api/patients/${patientId}`)
      .then(setPatient)
      .catch(() => setPatient(null));

    refreshEncounter(patientId);

    apiFetch(`/api/clinical-drafts/OPD_CONSULTATION?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => {
        const payload = res?.item?.payload;
        if (payload && typeof payload === "object") {
          setForm((prev) => ({ ...prev, ...payload }));
        } else {
          setForm(INITIAL_FORM);
        }
      })
      .catch(() => setForm(INITIAL_FORM));
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    const loadHospitals = async () => {
      try {
        const res = await apiFetch("/api/hospitals/marketplace?limit=1000");
        if (cancelled) return;
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setTransferHospitals(items);
      } catch {
        if (!cancelled) setTransferHospitals([]);
      }
    };
    loadHospitals();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTransferScope(scope, enabled) {
    setTransferForm((prev) => {
      const set = new Set(prev.scopes || []);
      if (enabled) set.add(scope);
      else set.delete(scope);
      return { ...prev, scopes: Array.from(set) };
    });
  }

  async function submitTransferRequest() {
    if (!patientId) {
      setMsg("Select a patient first.");
      return;
    }
    if (!transferForm.toHospitalId) {
      setMsg("Pick a destination hospital for the transfer.");
      return;
    }
    try {
      setTransferLoading(true);
      await requestTransfer({
        patient: patientId,
        toHospital: transferForm.toHospitalId,
        reasons: transferForm.reasons,
        scopes: transferForm.scopes,
        metadata: transferForm.handoverSummary ? { handoverSummary: transferForm.handoverSummary } : undefined,
      });
      setMsg("Transfer request sent.");
      setTransferForm((prev) => ({ ...prev, reasons: "", handoverSummary: "" }));
    } catch (e) {
      setMsg(e?.message || "Failed to send transfer request.");
    } finally {
      setTransferLoading(false);
    }
  }

  async function saveDraft() {
    if (!patientId) {
      setMsg("Select a patient first.");
      return;
    }
    try {
      await apiFetch(`/api/clinical-drafts/OPD_CONSULTATION?patientId=${encodeURIComponent(patientId)}`, {
        method: "PUT",
        body: { payload: form },
      });
      const patientName = patient
        ? [patient.firstName, patient.lastName].filter(Boolean).join(" ")
        : "selected patient";
      setMsg(`Consultation draft saved for ${patientName || "patient"}.`);
    } catch (e) {
      setMsg(e?.message || "Failed to save consultation draft.");
    }
  }

  async function promoteDraft() {
    if (!patientId) {
      setMsg("Select a patient first.");
      return;
    }
    try {
      setPromoting(true);
      await apiFetch(`/api/clinical-drafts/OPD_CONSULTATION?patientId=${encodeURIComponent(patientId)}`, {
        method: "PUT",
        body: { payload: form },
      });
      const res = await apiFetch(
        `/api/clinical-drafts/OPD_CONSULTATION/promote?patientId=${encodeURIComponent(patientId)}`,
        { method: "POST" }
      );
      const appointment = res?.appointment;
      await refreshEncounter(patientId);
      const patientName = patient
        ? [patient.firstName, patient.lastName].filter(Boolean).join(" ")
        : "selected patient";
      setMsg(
        `Consultation promoted for ${patientName || "patient"}${appointment?.status ? ` • ${appointment.status}` : ""}.`
      );
    } catch (e) {
      setMsg(e?.message || "Failed to promote consultation to appointment.");
    } finally {
      setPromoting(false);
    }
  }

  async function completeVisit() {
    if (!encounter?._id) {
      setMsg("Promote the consultation first to create the active visit.");
      return;
    }
    try {
      setClosing(true);
      const updated = await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/close`, {
        method: "POST",
      });
      await refreshEncounter(patientId);
      setMsg("Visit closed successfully.");
    } catch (e) {
      const missing = Array.isArray(e?.closeout?.missingRequirements) ? e.closeout.missingRequirements.join(", ") : "";
      setMsg(
        e?.message || e?.error || (missing ? `Cannot close visit yet. Missing: ${missing}` : "Failed to close visit.")
      );
    } finally {
      setClosing(false);
    }
  }

  async function applyCloseoutEffects() {
    if (!encounter?._id) {
      setMsg("Promote the consultation first to create the active visit.");
      return;
    }
    try {
      setHandoffLoading(true);
      const res = await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/closeout-effects`, {
        method: "POST",
        body: {
          diagnosis: form.diagnosis,
          diagnosisCode: form.diagnosisCode,
          labTests: form.labTests,
        },
      });
      await refreshEncounter(patientId);
      const createdLabs = Array.isArray(res?.labOrders) ? res.labOrders.length : 0;
      setMsg(
        `Closeout effects applied.${res?.diagnosis ? " Diagnosis recorded." : ""}${createdLabs ? ` ${createdLabs} lab order(s) created.` : ""}`
      );
    } catch (e) {
      setMsg(e?.message || "Failed to apply closeout effects.");
    } finally {
      setHandoffLoading(false);
    }
  }

  async function sendBillingHandoff() {
    if (!encounter?._id) {
      setMsg("Promote the consultation first to create the active visit.");
      return;
    }
    try {
      setBillingLoading(true);
      const res = await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/billing-handoff`, {
        method: "POST",
        body: {
          items: form.billingItems,
        },
      });
      await refreshEncounter(patientId);
      setMsg(
        `Billing handoff created${res?.invoice?.invoiceNumber ? ` • ${res.invoice.invoiceNumber}` : ""}.`
      );
    } catch (e) {
      setMsg(e?.message || "Failed to create billing handoff.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function resolveEscalation() {
    if (!encounter?._id) {
      setMsg("No active visit to resolve.");
      return;
    }
    try {
      setResolvingEscalation(true);
      const res = await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/nurse-escalation-resolve`, {
        method: "POST",
        body: { note: "Clinician reviewed nurse escalation in consultation workspace." },
      });
      await refreshEncounter(patientId);
      setMsg(`Escalation resolved for ${res?.resolved || 0} recipient notification(s).`);
    } catch (e) {
      setMsg(e?.message || "Failed to resolve escalation.");
    } finally {
      setResolvingEscalation(false);
    }
  }

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>OPD Clinic Workspace</h2>
          <p className="muted">Consultation screen for diagnosis, notes, treatment, and follow-up.</p>
        </div>
        <div className="welcome-actions">
          {patientId ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/medical-records?patientId=${patientId}`)}>
                Open Record
              </button>
              <button
                type="button"
                className={`btn-secondary${focus === "PRESCRIPTION" ? " active" : ""}`}
                onClick={() => navigate(`/doctor/prescriptions?patientId=${patientId}`)}
              >
                Prescribe
              </button>
            </>
          ) : null}
          <button type="button" className="btn-primary" onClick={saveDraft}>Save Draft</button>
          <button type="button" className="btn-secondary" onClick={promoteDraft} disabled={promoting}>
            {promoting ? "Promoting..." : "Promote To Visit"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>Print Summary</button>
        </div>
      </div>

      {patient ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <div>
                <h3>Patient Summary</h3>
                <p className="muted">
                  {[patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
                  {patient.nationalId ? ` • ${patient.nationalId}` : ""}
                </p>
              </div>
              <div className="action-pill">Ward: {patient.ward || "OPD"}</div>
            </div>
            <div className="grid info-grid">
              <div className="card stat">
                <div className="card-title">Status</div>
                <div className="card-value">{patient.status || "ACTIVE"}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Risk</div>
                <div className="card-value">{patient.riskLevel || "MEDIUM"}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Primary Diagnosis</div>
                <div className="card-value">{patient.primaryDiagnosis || "-"}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Visit State</div>
                <div className="card-value">{encounter?.state || "NOT_STARTED"}</div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      {escalationSummary?.count ? (
        <section className="section">
          <div className="card warning-card">
            <strong>{escalationSummary.unreadMine > 0 ? "Nurse escalation needs review" : "Nurse escalation logged"}</strong>
            <p className="muted" style={{ marginTop: 6 }}>
              {escalationSummary.latestBody || "Ward team requested clinician review before discharge or transfer."}
            </p>
            {escalationSummary.openCount > 0 ? (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 10 }}
                onClick={resolveEscalation}
                disabled={resolvingEscalation}
              >
                {resolvingEscalation ? "Resolving..." : "Mark Escalation Resolved"}
              </button>
            ) : (
              <div className="action-pill" style={{ marginTop: 10 }}>Escalation resolved</div>
            )}
          </div>
        </section>
      ) : null}

      {focusLabel ? (
        <section className="section">
          <div className="card warning-card">
            <strong>Next action</strong>
            <p className="muted" style={{ marginTop: 6 }}>
              This visit needs: {focusLabel}.
            </p>
            {focus === "PRESCRIPTION" ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/doctor/prescriptions?patientId=${patientId}`)}
              >
                Open Prescribe
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Clinical Notes</h3>
          <div className="grid" style={{ gap: 12 }}>
            <label>
              Symptoms
              <textarea rows={3} value={form.symptoms} onChange={(e) => updateField("symptoms", e.target.value)} placeholder="Key symptoms and concerns" />
            </label>
            <label>
              Assessment
              <textarea rows={3} value={form.assessment} onChange={(e) => updateField("assessment", e.target.value)} placeholder="Clinical assessment" />
            </label>
            <label>
              Diagnosis
              <input value={form.diagnosis} onChange={(e) => updateField("diagnosis", e.target.value)} placeholder="Primary diagnosis" />
            </label>
            <label>
              Diagnosis Code
              <input value={form.diagnosisCode} onChange={(e) => updateField("diagnosisCode", e.target.value)} placeholder="ICD-10 code (optional)" />
            </label>
            <label>
              Treatment Plan
              <textarea rows={4} value={form.treatmentPlan} onChange={(e) => updateField("treatmentPlan", e.target.value)} placeholder="Treatment and orders" />
            </label>
            <label>
              Follow-up
              <input value={form.followUp} onChange={(e) => updateField("followUp", e.target.value)} placeholder="Review date or instruction" />
            </label>
            <label>
              Lab Tests
              <input value={form.labTests} onChange={(e) => updateField("labTests", e.target.value)} placeholder="CBC, malaria test, chest x-ray" />
            </label>
            <label>
              Billing Items
              <textarea rows={4} value={form.billingItems} onChange={(e) => updateField("billingItems", e.target.value)} placeholder={"Consultation:1000\nProcedure:500"} />
            </label>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Consultation Actions</h3>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header-actions">
              <div>
                <strong>Transfer to another hospital</strong>
                <p className="muted" style={{ marginTop: 6 }}>
                  Share a handover summary and pick consent scopes for the receiving facility.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/hospital-admin/transfer-command-center")}
              >
                Transfer Center
              </button>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <div>
                <label className="input-label">Destination hospital</label>
                <select
                  value={transferForm.toHospitalId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, toHospitalId: e.target.value }))}
                >
                  <option value="">Select hospital</option>
                  {transferHospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name || h.code || "Hospital"} {h.city ? `• ${h.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Reason</label>
                <textarea
                  rows={2}
                  value={transferForm.reasons}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, reasons: e.target.value }))}
                  placeholder="Short reason for transfer"
                />
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 10 }}>
              <div>
                <label className="input-label">Handover summary</label>
                <textarea
                  rows={3}
                  value={transferForm.handoverSummary}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, handoverSummary: e.target.value }))}
                  placeholder="Key clinical notes for receiving team"
                />
              </div>
              <div>
                <label className="input-label">Consent scopes</label>
                <div className="pill-row">
                  {CONSENT_SCOPES.map((scope) => (
                    <label key={scope} className="pill-chip">
                      <input
                        type="checkbox"
                        checked={transferForm.scopes.includes(scope)}
                        onChange={(e) => toggleTransferScope(scope, e.target.checked)}
                      />
                      <span>{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="card-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={submitTransferRequest}
                disabled={transferLoading}
              >
                {transferLoading ? "Sending..." : "Send Transfer Request"}
              </button>
            </div>
          </div>
          {resolvedPolicy ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header-actions">
                <div>
                  <strong>Resolved Closeout Policy</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Source: {resolvedPolicy.overrideEnabled ? "Hospital override" : "Global default"}
                  </p>
                </div>
                <div className="action-pill">
                  {encounter?.closeout?.canClose ? "Ready To Close" : "Requirements Pending"}
                </div>
              </div>
              <div className="alert-stack" style={{ marginTop: 10 }}>
                <div className="action-pill">
                  Diagnosis rule: {resolvedPolicy.requireDiagnosisBeforeClose ? "Required" : "Optional"}
                </div>
                <div className="action-pill">
                  Billing rule: {resolvedPolicy.requireBillingHandoffWhenPaymentsEnabled ? "Required" : "Optional"}
                </div>
                <div className="action-pill">
                  Prescription rule: {resolvedPolicy.requirePrescriptionWhenPharmacyEnabled ? "Required" : "Optional"}
                </div>
              </div>
              {Array.isArray(encounter?.closeout?.missingRequirements) && encounter.closeout.missingRequirements.length ? (
                <p className="muted" style={{ marginTop: 10 }}>
                  Missing: {encounter.closeout.missingRequirements.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="alert-stack" style={{ marginBottom: 12 }}>
            <div className={`action-pill ${closeoutStatus.visit === "READY" ? "" : "danger"}`}>
              Visit: {closeoutStatus.visit === "READY" ? "Started" : "Promote consultation"}
            </div>
            <div className={`action-pill ${closeoutStatus.diagnosis === "DONE" ? "" : closeoutStatus.diagnosis === "OPTIONAL" ? "" : "warning"}`}>
              Diagnosis: {closeoutStatus.diagnosis === "DONE" ? "Ready" : closeoutStatus.diagnosis === "OPTIONAL" ? "Optional" : "Pending"}
            </div>
            <div className={`action-pill ${closeoutStatus.billing === "DONE" ? "" : closeoutStatus.billing === "OPTIONAL" ? "" : "warning"}`}>
              Billing: {closeoutStatus.billing === "DONE" ? "Ready" : closeoutStatus.billing === "OPTIONAL" ? "Optional" : "Pending"}
            </div>
            <div className={`action-pill ${closeoutStatus.prescriptions === "DONE" ? "" : closeoutStatus.prescriptions === "OPTIONAL" ? "" : "warning"}`}>
              Prescription: {closeoutStatus.prescriptions === "DONE" ? "Ready" : closeoutStatus.prescriptions === "OPTIONAL" ? "Optional" : "Pending"}
            </div>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Complete the visit after all required handoffs are ready for this hospital workflow.
          </p>
          <div className="alert-stack">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => (patientId ? navigate(`/doctor/reports-notes?patientId=${patientId}`) : navigate("/doctor/reports-notes"))}
            >
              Open Notes
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => (patientId ? navigate(`/doctor/referrals?patientId=${patientId}`) : navigate("/doctor/referrals"))}
            >
              Create Referral
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/hospital-admin/pharmacy-referrals")}
            >
              Send to Pharmacy
            </button>
            <button
              type="button"
              className={`btn-secondary${focus === "DIAGNOSIS" ? " active" : ""}`}
              onClick={applyCloseoutEffects}
              disabled={handoffLoading}
            >
              {handoffLoading ? "Sending..." : "Send Diagnosis & Labs"}
            </button>
            <button
              type="button"
              className={`btn-secondary${focus === "BILLING" ? " active" : ""}`}
              onClick={sendBillingHandoff}
              disabled={billingLoading}
            >
              {billingLoading ? "Sending..." : "Send Billing"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={completeVisit}
              disabled={closing || !encounter?._id || encounter?.closeout?.canClose === false}
            >
              {closing ? "Closing..." : encounter?.closeout?.canClose === false ? "Complete Visit Blocked" : "Complete Visit"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
