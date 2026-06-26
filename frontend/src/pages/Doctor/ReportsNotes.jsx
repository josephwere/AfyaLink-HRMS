import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import EditableSection from "../../components/EditableSection";
import GuidedEmptyState from "../../components/GuidedEmptyState";
import { showActionSuccessGuide } from "../../components/ActionSuccessGuide";

export default function ReportsNotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const [patient, setPatient] = useState(null);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [msg, setMsg] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftEditing, setDraftEditing] = useState(true);
  const [draftSaving, setDraftSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setSummary("");
      setNote("");
      setDraftSaved(false);
      setDraftEditing(true);
      return;
    }
    apiFetch(`/api/patients/${patientId}`)
      .then(setPatient)
      .catch(() => setPatient(null));

    apiFetch(`/api/clinical-drafts/DOCTOR_NOTE?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => {
        const payload = res?.item?.payload;
        if (payload && typeof payload === "object") {
          setSummary(String(payload.summary || ""));
          setNote(String(payload.note || ""));
          setDraftSaved(true);
          setDraftEditing(false);
        } else {
          setSummary("");
          setNote("");
          setDraftSaved(false);
          setDraftEditing(true);
        }
      })
      .catch(() => {
        setSummary("");
        setNote("");
        setDraftSaved(false);
        setDraftEditing(true);
      });
  }, [patientId]);

  async function saveDraft() {
    if (!patientId) return;
    setDraftSaving(true);
    setMsg("");
    try {
      await apiFetch(`/api/clinical-drafts/DOCTOR_NOTE?patientId=${encodeURIComponent(patientId)}`, {
        method: "PUT",
        body: {
          payload: {
            summary,
            note,
          },
        },
      });
      setDraftSaved(true);
      setDraftEditing(false);
      showActionSuccessGuide({
        title: "Doctor Note Template Saved",
        message: "The note draft is locked and ready to promote into the patient record when reviewed.",
        icon: "✓",
        notificationTitle: "Doctor note saved",
        notificationBody: "A clinical note draft was saved for this patient.",
        notificationCategory: "CLINICAL",
        aiRecommendation: "Use AI to review the note structure before promoting it to the official visit record.",
        nextActions: [
          {
            label: "Review With AI",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Review this doctor note draft for clarity, missing clinical context, and a SOAP-style structure.",
          },
        ],
      });
    } catch (e) {
      setMsg(e?.message || "Failed to save note draft.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function promoteDraft() {
    if (!patientId) return;
    try {
      setPromoting(true);
      await apiFetch(`/api/clinical-drafts/DOCTOR_NOTE?patientId=${encodeURIComponent(patientId)}`, {
        method: "PUT",
        body: {
          payload: {
            summary,
            note,
          },
        },
      });
      await apiFetch(`/api/clinical-drafts/DOCTOR_NOTE/promote?patientId=${encodeURIComponent(patientId)}`, {
        method: "POST",
      });
      showActionSuccessGuide({
        title: "Note Promoted To Visit Record",
        message: "The reviewed note is now available in the patient visit record.",
        icon: "✓",
        notificationTitle: "Clinical note promoted",
        notificationBody: "A doctor note was promoted into the patient record.",
        notificationCategory: "CLINICAL",
        aiRecommendation: "Ask AI to prepare follow-up reminders, referral suggestions, or patient education points.",
        nextActions: [
          {
            label: "Ask AI For Follow-Up",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Suggest follow-up questions, reminders, and patient education points based on a promoted doctor note.",
          },
        ],
      });
    } catch (e) {
      setMsg(e?.message || "Failed to promote note draft.");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Reports & Notes</h2>
          <p className="muted">Case notes, structured summaries, and exports in the current patient context.</p>
        </div>
        <div className="welcome-actions">
          {patientId ? (
            <>
              <button type="button" className="btn-primary" onClick={() => navigate(`/doctor/opd?patientId=${patientId}`)}>
                Back To Consultation
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate(`/doctor/medical-records?patientId=${patientId}`)}>
                Medical Record
              </button>
            </>
          ) : null}
          <button type="button" className="btn-secondary" onClick={promoteDraft} disabled={promoting}>
            {promoting ? "Promoting..." : "Promote To Visit"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Print Note
          </button>
        </div>
      </div>

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      {!patientId ? (
        <section className="section">
          <GuidedEmptyState
            icon="Pt"
            title="No Patient Context Selected"
            body="Open reports and notes from a patient record, consultation, or ward board so the note is linked safely."
            actions={[
              {
                label: "Find Patients",
                path: "/app/care/patients/index",
                variant: "primary",
              },
              {
                label: "Ask AI For Note Checklist",
                aiPrompt: "Give me a doctor note checklist I can use before selecting a patient context.",
              },
            ]}
          />
        </section>
      ) : null}

      {patient ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <div>
                <h3>Selected Patient</h3>
                <p className="muted">
                  {[patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
                  {patient.nationalId ? ` • ${patient.nationalId}` : ""}
                </p>
              </div>
              <div className="action-pill">Risk: {patient.riskLevel || "MEDIUM"}</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section doctor-main-grid">
        <EditableSection
          className="doctor-schedule-card"
          title="Case Note"
          description="Save the draft, then review and promote it into the visit record."
          saved={draftSaved}
          editing={draftEditing}
          saving={draftSaving}
          saveLabel="Save Draft"
          onEdit={() => setDraftEditing(true)}
          onCancel={() => setDraftEditing(false)}
          onSave={saveDraft}
        >
          <div className="grid" style={{ gap: 12 }}>
            <label>
              Summary
              <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short note title or summary" />
            </label>
            <label>
              Detailed Note
              <textarea rows={10} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Clinical note, review, handover, or report detail" />
            </label>
          </div>
        </EditableSection>

        <div className="card doctor-alerts-card">
          <h3>Export Context</h3>
          <div className="alert-stack">
            <div className="action-pill">Keep notes aligned with the consultation and medical record.</div>
            <div className="action-pill">Use the same patient context for referrals and prescriptions.</div>
            <div className="action-pill">Printed notes should come from the currently selected patient.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
