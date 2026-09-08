import React from "react";
import ContentSkeleton from "../../components/ContentSkeleton";
import GuidedEmptyState from "../../components/GuidedEmptyState";
import { usePatientPrescriptions } from "../../hooks/usePatientPrescriptions";

export default function PatientPrescriptions() {
  const { items, referrals, filter, setFilter, loading, msg, visible, load } = usePatientPrescriptions();

  const openAiAssistant = (prompt) => {
    window.dispatchEvent(
      new CustomEvent("afyalink:ai-open", {
        detail: {
          prompt,
          source: "patient-prescriptions",
        },
      })
    );
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Prescriptions</h2>
          <p className="muted">See active medicines, care advice, and past prescription history.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}
      {loading && !items.length ? <ContentSkeleton title="Loading prescriptions" cards={2} /> : null}

      <section className="section">
        <div className="card premium-card">
          <label>Filter</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">All Prescriptions</option>
            <option value="CREATED">Active</option>
            <option value="DISPENSED">Dispensed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </section>

      <section className="section">
        <div className="doctor-main-grid">
          <div className="grid info-grid">
          {visible.map((item) => (
            <div key={item._id} className="card premium-card">
              <h3 style={{ marginTop: 0 }}>
                {item?.appointment?.serviceType || item.summary || "Prescription"}
              </h3>
              <p className="muted">Status: {item.status}</p>
              {item.dispensedAt ? (
                <p className="muted">
                  Dispensed: {new Date(item.dispensedAt).toLocaleString()}
                </p>
              ) : null}
              {item.summary ? <p>{item.summary}</p> : null}
              {item.advice ? <p className="muted">Advice: {item.advice}</p> : null}
              <div className="doctor-actions-row" style={{ margin: "10px 0" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    openAiAssistant(
                      `Explain this prescription in simple language, including how to take the medicines and what questions I should ask my doctor. Summary: ${item.summary || "No summary"}. Advice: ${item.advice || "No advice"}. Medicines: ${(item.medications || []).map((med) => `${med.name || "Medicine"} ${med.dosage || ""} ${med.frequency || ""} ${med.duration || ""}`).join("; ")}`
                    )
                  }
                >
                  Explain With AI
                </button>
              </div>
              <div className="alert-stack">
                {(item.medications || []).map((med, index) => (
                  <div key={index} className="card">
                    <strong>{med.name || "Medicine"}</strong>
                    <div className="muted">
                      {med.dosage || "—"} • {med.frequency || "—"} • {med.duration || "—"}
                    </div>
                  </div>
                ))}
                {!(item.medications || []).length ? <div className="muted">No medication lines.</div> : null}
              </div>
              {item?.appointment?.metadata?.consultationSummary?.followUpDate ? (
                <div className="action-pill" style={{ marginTop: 10 }}>
                  Follow-up: {new Date(item.appointment.metadata.consultationSummary.followUpDate).toLocaleDateString()}
                </div>
              ) : null}
            </div>
          ))}
          {!visible.length && !loading ? (
            <GuidedEmptyState
              icon="Rx"
              title="No Prescriptions Yet"
              body="Prescriptions from your doctor will appear here with medicine details and pharmacy progress."
              actions={[
                { label: "Book Consultation", path: "/patient/appointments", variant: "primary" },
                {
                  label: "Ask AI",
                  aiPrompt: "I do not have prescriptions yet. Help me prepare questions to ask my doctor about medicines, side effects, and follow-up.",
                },
              ]}
            />
          ) : null}
          </div>

          <div className="card premium-card">
            <h3>Pharmacy Referral Progress</h3>
            <div className="alert-stack">
              {referrals.map((item) => (
                <div key={item._id} className="card">
                  <strong>{item?.pharmacy?.name || "Pharmacy"}</strong>
                  <p className="muted">{item.reason || "Medication handoff"}</p>
                  <div className="action-pill">{item.status}</div>
                  {item.medicationNotes ? <p className="muted" style={{ marginTop: 8 }}>{item.medicationNotes}</p> : null}
                </div>
              ))}
              {!referrals.length ? (
                <GuidedEmptyState
                  compact
                  icon="H"
                  title="No Referrals Available"
                  body="Your doctor can create pharmacy referrals when medication handoff is needed."
                  actions={[
                    {
                      label: "Ask AI",
                      aiPrompt: "Explain what a pharmacy referral is and what I should ask my clinician if I need medication support.",
                    },
                  ]}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
