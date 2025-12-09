import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Patients({ api, token }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showVitals, setShowVitals] = useState(false);

  const [patientForm, setPatientForm] = useState({ name: "", age: "", gender: "", condition: "" });
  const [vitalsForm, setVitalsForm] = useState({ temperature: "", bloodPressure: "", pulse: "" });

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.get(`${api}/patients`, auth);
      setPatients(res.data);
    } catch {
      setErr("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const submitPatient = async (e) => {
    e.preventDefault();
    try {
      if (editing) await axios.put(`${api}/patients/${editing}`, patientForm, auth);
      else await axios.post(`${api}/patients`, patientForm, auth);
      setPatientForm({ name: "", age: "", gender: "", condition: "" });
      setEditing(null);
      loadPatients();
    } catch { setErr("Error saving patient"); }
  };

  const submitVitals = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${api}/patients/${selected._id}/vitals`, vitalsForm, auth);
      setVitalsForm({ temperature: "", bloodPressure: "", pulse: "" });
      setShowVitals(false);
      loadPatients();
    } catch { setErr("Error saving vitals"); }
  };

  const startEdit = (p) => {
    setEditing(p._id);
    setPatientForm({ name: p.name, age: p.age, gender: p.gender, condition: p.condition });
  };

  const viewPatient = (p) => setSelected(p);

  return (
    <div className="premium-card">
      <h2>Patients</h2>
      {err && <p className="error-msg">{err}</p>}

      {/* PATIENT FORM */}
      <form onSubmit={submitPatient} className="card form-card">
        <h3>{editing ? "Edit Patient" : "Add Patient"}</h3>
        <label>Name</label>
        <input value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} required />
        <label>Age</label>
        <input type="number" value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })} required />
        <label>Gender</label>
        <select value={patientForm.gender} onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })} required>
          <option value="">-- select --</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <label>Condition</label>
        <input value={patientForm.condition} onChange={(e) => setPatientForm({ ...patientForm, condition: e.target.value })} />
        <div className="form-buttons">
          <button className="button gradient-blue" type="submit">{editing ? "Update" : "Add"}</button>
          {editing && (
            <button className="button cancel-btn" type="button" onClick={() => { setEditing(null); setPatientForm({ name: "", age: "", gender: "", condition: "" }); }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* PATIENT LIST */}
      {loading ? (
        <div className="premium-card" style={{ textAlign: "center" }}>Loading...</div>
      ) : (
        <table className="table premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Gender</th>
              <th>Condition</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? patients.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.age}</td>
                <td>{p.gender}</td>
                <td>{p.condition}</td>
                <td>
                  <button className="button gradient-purple" onClick={() => viewPatient(p)} aria-label={`View ${p.name}`}>🔍</button>
                  <button className="button gradient-green" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`} style={{ marginLeft: 5 }}>✏️</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>No patients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* PATIENT DETAILS POPUP */}
      {selected && (
        <div className="premium-card details-card">
          <h3>Patient Details</h3>
          <p><strong>Name:</strong> {selected.name}</p>
          <p><strong>Age:</strong> {selected.age}</p>
          <p><strong>Gender:</strong> {selected.gender}</p>
          <p><strong>Condition:</strong> {selected.condition}</p>
          <h4>Vitals</h4>
          {selected.vitals?.length ? (
            <ul>{selected.vitals.map((v, i) => (
              <li key={i}>{v.date && <strong>{new Date(v.date).toLocaleString()}:</strong>} Temp: {v.temperature}, BP: {v.bloodPressure}, Pulse: {v.pulse}</li>
            ))}</ul>
          ) : (<p>No vitals recorded.</p>)}
          <div className="form-buttons">
            <button className="button gradient-blue" onClick={() => setShowVitals(true)}>Add Vitals</button>
            <button className="button cancel-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      {/* ADD VITALS FORM */}
      {showVitals && (
        <form onSubmit={submitVitals} className="card form-card">
          <h3>Add Vitals for {selected?.name}</h3>
          <label>Temperature (°C)</label>
          <input value={vitalsForm.temperature} onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })} required />
          <label>Blood Pressure</label>
          <input value={vitalsForm.bloodPressure} onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })} required />
          <label>Pulse</label>
          <input value={vitalsForm.pulse} onChange={(e) => setVitalsForm({ ...vitalsForm, pulse: e.target.value })} required />
          <div className="form-buttons">
            <button className="button gradient-purple" type="submit">💾 Save Vitals</button>
            <button className="button cancel-btn" type="button" onClick={() => setShowVitals(false)}>Cancel</button>
          </div>
        </form>
      )}

      <style>{`
        .premium-card {
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(12px);
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
          margin-bottom: 24px;
        }

        .form-card label { display:block; margin-top:10px; margin-bottom:4px; font-weight:500; }
        .form-card input, .form-card select { width:100%; padding:8px 10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px; font-size:14px; }
        .form-buttons { display:flex; gap:10px; margin-top:12px; }
        .cancel-btn { background:#777; color:white; transition: transform 0.2s; }
        .cancel-btn:hover { transform: translateY(-2px); }

        .table { width:100%; border-collapse:collapse; margin-top:20px; font-size:14px; }
        .table th, .table td { padding:12px 8px; text-align:left; }
        .table th { background: linear-gradient(135deg,#4f46e5,#06b6d4); color:#fff; }
        .table tr { transition: transform 0.2s, background 0.2s; }
        .table tr:hover { background: rgba(59,130,246,0.1); }

        .gradient-blue { background: linear-gradient(135deg, #3b82f6, #1e40af); color:white; }
        .gradient-purple { background: linear-gradient(135deg, #a855f7, #6d28d9); color:white; }
        .gradient-green { background: linear-gradient(135deg, #10b981, #047857); color:white; }
        .button { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-weight:600; transition: transform 0.2s; }
        .button:hover { transform: translateY(-2px); }
        .error-msg { color:#ef4444; margin-bottom:12px; font-weight:600; }
      `}</style>
    </div>
  );
                                 }
