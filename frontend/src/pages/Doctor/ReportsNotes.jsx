import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

export default function ReportsNotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const [patient, setPatient] = useState(null);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [msg, setMsg] = useState("");
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setSummary("");
      setNote("");
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
        } else {
          setSummary("");
          setNote("");
        }
      })
      .catch(() => {
        setSummary("");
        setNote("");
      });
  }, [patientId]);

  async function saveDraft() {
    if (!patientId) return;
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
      setMsg("Note draft saved.");
    } catch (e) {
      setMsg(e?.message || "Failed to save note draft.");
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
      setMsg("Note promoted into the patient visit record.");
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
          <button type="button" className="btn-secondary" onClick={saveDraft}>
            Save Draft
          </button>
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
          <div className="card muted">Open this page from a patient record, consultation, or ward board.</div>
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
        <div className="card doctor-schedule-card">
          <h3>Case Note</h3>
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
        </div>

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
