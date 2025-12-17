import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Appointments({ api, token }) {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ patient: "", doctor: "", date: "", reason: "" });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    loadAppointments();
    loadPatients();
    loadDoctors();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.get(`${api}/appointments`, auth);
      setAppointments(res.data);
    } catch (e) {
      setErr("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const res = await axios.get(`${api}/patients`, auth);
      setPatients(res.data);
    } catch {}
  };

  const loadDoctors = async () => {
    try {
      const res = await axios.get(`${api}/auth/users`, auth);
      setDoctors(res.data.filter((u) => u.role === "doctor"));
    } catch {}
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${api}/appointments/${editing}`, form, auth);
      } else {
        await axios.post(`${api}/appointments`, form, auth);
      }
      setForm({ patient: "", doctor: "", date: "", reason: "" });
      setEditing(null);
      loadAppointments();
    } catch (e) {
      setErr("Failed to save appointment");
    }
  };

  const startEdit = (a) => {
    setEditing(a._id);
    setForm({
      patient: a.patient?._id || "",
      doctor: a.doctor?._id || "",
      date: a.date?.substring(0, 16) || "",
      reason: a.reason || ""
    });
  };

  return (
    <div className="card premium-card">
      <h2>Appointments</h2>

      {err && <div style={{ color: "red", marginBottom: 12 }}>{err}</div>}

      {/* ===== APPOINTMENT FORM ===== */}
      <form onSubmit={submit} className="card appointment-form">
        <h3>{editing ? "Update Appointment" : "Create Appointment"}</h3>

        <label>Patient</label>
        <select
          value={form.patient}
          onChange={(e) => setForm({ ...form, patient: e.target.value })}
          required
        >
          <option value="">-- Select Patient --</option>
          {patients.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        <label>Doctor</label>
        <select
          value={form.doctor}
          onChange={(e) => setForm({ ...form, doctor: e.target.value })}
          required
        >
          <option value="">-- Select Doctor --</option>
          {doctors.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>

        <label>Date & Time</label>
        <input
          type="datetime-local"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />

        <label>Reason</label>
        <input
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          required
        />

        <div className="form-buttons">
          <button className="button gradient-blue" type="submit" aria-label={editing ? "Update appointment" : "Create appointment"}>
            {editing ? "Update" : "Create"}
          </button>

          {editing && (
            <button
              className="button cancel-btn"
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({ patient: "", doctor: "", date: "", reason: "" });
              }}
              aria-label="Cancel edit appointment"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ===== APPOINTMENT LIST ===== */}
      {loading ? (
        <div className="premium-card" style={{ textAlign: "center" }}>Loading...</div>
      ) : (
        <table className="table premium-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length > 0 ? appointments.map((a) => (
              <tr key={a._id}>
                <td>{a.patient?.name}</td>
                <td>{a.doctor?.name}</td>
                <td>{new Date(a.date).toLocaleString()}</td>
                <td>{a.reason}</td>
                <td>
                  <button
                    className="button gradient-purple"
                    onClick={() => startEdit(a)}
                    aria-label={`Edit appointment for ${a.patient?.name}`}
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>No appointments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <style>{`
        .premium-card {
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(12px);
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
          margin-bottom: 24px;
        }

        .appointment-form label {
          display: block;
          margin-top: 10px;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .appointment-form input,
        .appointment-form select {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
          margin-bottom: 10px;
        }

        .form-buttons {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .cancel-btn {
          background: #aaa;
          color: white;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .table th, .table td {
          padding: 12px 8px;
          text-align: left;
        }

        .table th {
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: #fff;
        }

        .table tr {
          transition: transform 0.2s, background 0.2s;
        }

        .table tr:hover {
          background: rgba(59, 130, 246, 0.1);
        }

        .gradient-blue { background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; }
        .gradient-purple { background: linear-gradient(135deg, #a855f7, #6d28d9); color: white; }

        .button {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          transition: 0.3s;
        }

        .button:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
                }
