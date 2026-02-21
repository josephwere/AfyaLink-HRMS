import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientsCursor, setPatientsCursor] = useState(null);
  const [patientsHasMore, setPatientsHasMore] = useState(false);
  const [patientsLoadingMore, setPatientsLoadingMore] = useState(false);
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
        apiFetch("/api/patients?cursorMode=1&limit=50"),
        apiFetch("/api/users"),
      ]);

      setAppointments(Array.isArray(a) ? a : a?.items || []);
      const patientItems = Array.isArray(p) ? p : p?.items || [];
      setPatients(patientItems);
      setPatientsCursor(p?.nextCursor || null);
      setPatientsHasMore(Boolean(p?.hasMore));
      setDoctors((u || []).filter((x) => x.role === "DOCTOR"));
    } catch {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  async function loadMorePatients() {
    if (!patientsCursor || patientsLoadingMore) return;
    setPatientsLoadingMore(true);
    try {
      const data = await apiFetch(
        `/api/patients?cursorMode=1&limit=50&cursor=${encodeURIComponent(patientsCursor)}`
      );
      const patientItems = Array.isArray(data) ? data : data?.items || [];
      setPatients((prev) => [...prev, ...patientItems]);
      setPatientsCursor(data?.nextCursor || null);
      setPatientsHasMore(Boolean(data?.hasMore));
    } catch {
      // ignore
    } finally {
      setPatientsLoadingMore(false);
    }
  }

  async function createAppointment(e) {
    e.preventDefault();
    setError("");

    try {
      await apiFetch("/api/appointments", {
        method: "POST",
        body: form,
      });

      setForm({ patient: "", doctor: "", scheduledAt: "", reason: "" });
      loadAll();
    } catch {
      setError("Failed to create appointment");
    }
  }

  async function cancelAppointment(id) {
    if (!confirm("Cancel appointment?")) return;

    try {
      await apiFetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
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
