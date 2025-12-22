import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    scheduledAt: "",
    reason: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [a, p, u] = await Promise.all([
        apiFetch("/api/appointments"),
        apiFetch("/api/patients"),
        apiFetch("/api/auth/users"),
      ]);

      if (!a.ok || !p.ok || !u.ok) throw new Error();

      setAppointments(await a.json());
      setPatients(await p.json());
      setDoctors((await u.json()).filter((x) => x.role === "doctor"));
    } catch {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  async function createAppointment(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await apiFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error();

      setForm({ patient: "", doctor: "", scheduledAt: "", reason: "" });
      loadAll();
    } catch {
      setError("Failed to create appointment");
    }
  }

  async function cancelAppointment(id) {
    if (!confirm("Cancel appointment?")) return;

    try {
      const res = await apiFetch(`/api/appointments/${id}/cancel`, {
        method: "POST",
      });

      if (!res.ok) throw new Error();
      loadAll();
    } catch {
      alert("Cancellation failed");
    }
  }

  return (
    <div className="card premium-card">
      <h2>Appointments</h2>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <form onSubmit={createAppointment} className="card appointment-form">
        <h3>Schedule Appointment</h3>

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

        <select
          value={form.doctor}
          onChange={(e) => setForm({ ...form, doctor: e.target.value })}
          required
        >
          <option value="">Select doctor</option>
          {doctors.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) =>
            setForm({ ...form, scheduledAt: e.target.value })
          }
          required
        />

        <input
          placeholder="Reason"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          required
        />

        <button className="button gradient-blue">Schedule</button>
      </form>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="table premium-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a._id}>
                <td>{a.patient?.name}</td>
                <td>{a.doctor?.name}</td>
                <td>{new Date(a.scheduledAt).toLocaleString()}</td>
                <td>{a.status}</td>
                <td>
                  {a.status === "Scheduled" && (
                    <button
                      className="button cancel-btn"
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
      )}
    </div>
  );
}
