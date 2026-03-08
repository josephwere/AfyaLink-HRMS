import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function ReceptionistBookingDesk() {
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    patient: "",
    serviceType: "General Consultation",
    consultationMode: "IN_PERSON",
    scheduledAt: "",
    reason: "",
    doctor: "",
  });

  const loadPatients = async (query) => {
    const q = String(query || "").trim();
    if (!q) {
      setPatients([]);
      return;
    }
    setLoadingPatients(true);
    try {
      const rows = await apiFetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      setPatients(Array.isArray(rows) ? rows : []);
    } catch {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadSuggestions = async () => {
    if (!form.serviceType) {
      setSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        serviceType: form.serviceType,
        consultationMode: form.consultationMode,
        limit: "5",
      });
      if (form.scheduledAt) {
        params.set("preferredDate", new Date(form.scheduledAt).toISOString());
      }
      const res = await apiFetch(`/api/appointments/suggestions?${params.toString()}`);
      setSuggestions(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients(patientQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  useEffect(() => {
    loadSuggestions();
  }, [form.serviceType, form.consultationMode, form.scheduledAt]);

  const submit = async (payloadOverride = null) => {
    if (!form.patient) {
      setMsg("Pick a patient first.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = payloadOverride || {
        patient: form.patient,
        serviceType: form.serviceType,
        consultationMode: form.consultationMode,
        scheduledAt: form.scheduledAt,
        reason: form.reason || undefined,
        doctor: form.doctor || undefined,
      };
      await apiFetch("/api/appointments", {
        method: "POST",
        body: payload,
      });
      setMsg("Appointment booked from front desk.");
      setForm((prev) => ({
        ...prev,
        scheduledAt: "",
        reason: "",
        doctor: "",
      }));
    } catch (err) {
      setMsg(err?.message || "Failed to book appointment");
    } finally {
      setSaving(false);
    }
  };

  const bookSuggestion = async (suggestion) => {
    const slotDate = suggestion?.appointmentTime ? new Date(suggestion.appointmentTime) : null;
    if (!slotDate || Number.isNaN(slotDate.getTime())) {
      setMsg("Suggestion is not ready.");
      return;
    }
    await submit({
      patient: form.patient,
      serviceType: form.serviceType,
      consultationMode: form.consultationMode,
      scheduledAt: slotDate.toISOString(),
      doctor: suggestion.doctorId,
      reason: form.reason || undefined,
    });
  };

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
          />
          <label>Reason</label>
          <input
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Why the patient is visiting"
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
