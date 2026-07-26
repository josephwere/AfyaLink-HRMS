import React from "react";
import { useAppointments } from "../hooks/useAppointments";

export default function Appointments() {
  const {
    appointments,
    patients,
    patientsHasMore,
    patientsLoadingMore,
    doctors,
    form,
    setForm,
    loading,
    error,
    loadMorePatients,
    createAppointmentEntry,
    cancelAppointmentEntry,
  } = useAppointments();

  async function createAppointment(e) {
    e.preventDefault();
    await createAppointmentEntry(form);
  }

  async function cancelAppointment(id) {
    await cancelAppointmentEntry(id);
  }

  return (
    <div className="dashboard">
      <h2>Appointments</h2>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <form onSubmit={createAppointment} className="card form">
        <h3>Book Service Appointment</h3>
        <p className="muted">
          Select the patient, service, and preferred time. AfyaLink assigns the right available clinician automatically.
        </p>

        <label>Patient</label>
        <select
          value={form.patient}
          onChange={(e) => setForm({ ...form, patient: e.target.value })}
          required
        >
          <option value="">Select patient</option>
          {patients.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        {patientsHasMore && (
          <button
            type="button"
            className="btn-secondary"
            onClick={loadMorePatients}
            disabled={patientsLoadingMore}
          >
            {patientsLoadingMore ? "Loading..." : "Load more patients"}
          </button>
        )}

        <label>Service</label>
        <input
          placeholder="General Consultation"
          value={form.serviceType}
          onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
          required
        />

        <label>Preferred clinician (optional)</label>
        <select
          value={form.doctor}
          onChange={(e) => setForm({ ...form, doctor: e.target.value })}
        >
          <option value="">Hospital assigns automatically</option>
          {doctors.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>

        <label>Date and time</label>
        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) =>
            setForm({ ...form, scheduledAt: e.target.value })
          }
          required
        />

        <label>Reason</label>
        <input
          placeholder="Reason"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          required
        />

        <div>
          <button className="btn-primary" type="submit">Book Appointment</button>
        </div>
      </form>

      <div className="card premium-card">
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Care team</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a._id}>
                    <td>{a.patient?.name}</td>
                    <td>{a.doctor?.name || "Hospital scheduling"}</td>
                    <td>{new Date(a.scheduledAt).toLocaleString()}</td>
                    <td>{a.status}</td>
                    <td>
                      {a.status === "Scheduled" && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => cancelAppointment(a._id)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
