import React from "react";
import useReceptionistBooking from "../../hooks/useReceptionistBooking";

export default function ReceptionistBookingDesk() {
  const {
    patientQuery,
    setPatientQuery,
    patients,
    suggestions,
    saving,
    loadingPatients,
    msg,
    form,
    setForm,
    submit,
    bookSuggestion,
  } = useReceptionistBooking();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Front Desk Booking Desk</h2>
          <p className="muted">Search patient, pick service, and book the fastest available hospital slot.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section doctor-main-grid">
        <div className="card premium-card">
          <h3>Patient Search</h3>
          <label>Find patient</label>
          <input
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
            placeholder="Search by first name, last name, or national ID"
            data-ai-label="Patient Search"
            data-ai-aliases="patient lookup|find patient|search patient by national id|front desk patient"
            data-ai-widget="patient-search"
            data-ai-intent="lookup"
            data-ai-priority="high"
          />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>National ID</th>
                  <th>Pick</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient._id}>
                    <td>{`${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient"}</td>
                    <td>{patient.nationalId || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setForm((prev) => ({ ...prev, patient: patient._id }))}
                        data-ai-action="select-patient-result"
                        data-ai-label="Select Patient Result"
                        data-ai-aliases="pick patient|confirm patient row|select matching patient"
                        data-ai-help={`${`${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient"} ${patient.nationalId ? `| ${patient.nationalId}` : ""}`}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
                {!patients.length && (
                  <tr>
                    <td colSpan={3} className="muted">
                      {loadingPatients ? "Searching..." : "No patient selected yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form
          className="card premium-card"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h3>Quick Booking</h3>
          <label>Service</label>
          <select
            value={form.serviceType}
            onChange={(e) => setForm((prev) => ({ ...prev, serviceType: e.target.value }))}
            data-ai-label="Booking Service"
            data-ai-aliases="service type|appointment service|clinic service"
            data-ai-priority="high"
          >
            <option value="General Consultation">General Consultation</option>
            <option value="Outpatient Review">Outpatient Review</option>
            <option value="Paediatrics">Paediatrics</option>
            <option value="Antenatal Care">Antenatal Care</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Surgery Review">Surgery Review</option>
            <option value="Physiotherapy">Physiotherapy</option>
            <option value="Mental Health">Mental Health</option>
          </select>
          <label>Consultation type</label>
          <select
            value={form.consultationMode}
            onChange={(e) => setForm((prev) => ({ ...prev, consultationMode: e.target.value }))}
            data-ai-label="Consultation Type"
            data-ai-aliases="consultation mode|appointment mode|visit mode"
            data-ai-priority="high"
          >
            <option value="IN_PERSON">In person</option>
            <option value="CHAT">Chat</option>
            <option value="VOICE">Voice call</option>
            <option value="VIDEO">Video call</option>
          </select>
          <label>Preferred time</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
            data-ai-label="Preferred Appointment Time"
            data-ai-aliases="preferred time|booking time|appointment date and time|visit time"
            data-ai-priority="high"
          />
          <label>Reason</label>
          <input
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Why the patient is visiting"
            data-ai-label="Appointment Reason"
            data-ai-aliases="visit reason|booking reason|chief complaint"
            data-ai-priority="high"
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Booking..." : "Book Appointment"}
          </button>
        </form>
      </section>

      <section className="section">
        <h3>Fastest Suggested Slots</h3>
        <div className="grid info-grid">
          {suggestions.map((item, index) => (
            <div key={`${item.doctorId}-${index}`} className="card premium-card">
              <h4 style={{ marginTop: 0 }}>{item.doctorName}</h4>
              <p className="muted">{item.specialization || form.serviceType}</p>
              <div className="action-pill">
                {item.appointmentTime ? new Date(item.appointmentTime).toLocaleString() : "No slot"}
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 12 }}
                disabled={saving || !form.patient}
                data-ai-action="book-front-desk-suggested-slot"
                data-ai-label="Book Front Desk Suggested Slot"
                data-ai-aliases="book this slot|confirm suggested booking|front desk slot booking"
                data-ai-help={`${item.doctorName || "Doctor"} | ${item.specialization || form.serviceType} | ${item.appointmentTime ? new Date(item.appointmentTime).toLocaleString() : "No slot"}`}
                onClick={() => bookSuggestion(item)}
              >
                {saving ? "Booking..." : "Book This Slot"}
              </button>
            </div>
          ))}
          {!suggestions.length && (
            <div className="card premium-card">
              <p className="muted">No quick slots found yet. Change service or preferred time.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
