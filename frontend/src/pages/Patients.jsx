import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/auth";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showVitals, setShowVitals] = useState(false);

  const [patientForm, setPatientForm] = useState({
    name: "",
    age: "",
    gender: "",
    condition: "",
  });

  const [vitalsForm, setVitalsForm] = useState({
    temperature: "",
    bloodPressure: "",
    pulse: "",
  });

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch("/api/patients");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPatients(data);
    } catch {
      setErr("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const submitPatient = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const res = editing
        ? await apiFetch(`/api/patients/${editing}`, {
            method: "PUT",
            body: JSON.stringify(patientForm),
          })
        : await apiFetch("/api/patients", {
            method: "POST",
            body: JSON.stringify(patientForm),
          });

      if (!res.ok) throw new Error();

      setPatientForm({
        name: "",
        age: "",
        gender: "",
        condition: "",
      });
      setEditing(null);
      loadPatients();
    } catch {
      setErr("Error saving patient");
    }
  };

  const submitVitals = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const res = await apiFetch(
        `/api/patients/${selected._id}/vitals`,
        {
          method: "POST",
          body: JSON.stringify(vitalsForm),
        }
      );

      if (!res.ok) throw new Error();

      setVitalsForm({
        temperature: "",
        bloodPressure: "",
        pulse: "",
      });
      setShowVitals(false);
      loadPatients();
    } catch {
      setErr("Error saving vitals");
    }
  };

  const startEdit = (p) => {
    setEditing(p._id);
    setPatientForm({
      name: p.name || "",
      age: p.age || "",
      gender: p.gender || "",
      condition: p.condition || "",
    });
  };

  const viewPatient = (p) => {
    setSelected(p);
    setShowVitals(false);
  };

  return (
    <div className="premium-card">
      <h2>Patients</h2>

      {err && <p className="error-msg">{err}</p>}

      {/* ===== PATIENT FORM ===== */}
      <form onSubmit={submitPatient} className="card form-card">
        <h3>{editing ? "Edit Patient" : "Add Patient"}</h3>

        <label>Name</label>
        <input
          value={patientForm.name}
          onChange={(e) =>
            setPatientForm({ ...patientForm, name: e.target.value })
          }
          required
        />

        <label>Age</label>
        <input
          type="number"
          value={patientForm.age}
          onChange={(e) =>
            setPatientForm({ ...patientForm, age: e.target.value })
          }
          required
        />

        <label>Gender</label>
        <select
          value={patientForm.gender}
          onChange={(e) =>
            setPatientForm({ ...patientForm, gender: e.target.value })
          }
          required
        >
          <option value="">-- select --</option>
          <option>Male</option>
          <option>Female</option>
        </select>

        <label>Condition</label>
        <input
          value={patientForm.condition}
          onChange={(e) =>
            setPatientForm({
              ...patientForm,
              condition: e.target.value,
            })
          }
        />

        <div className="form-buttons">
          <button className="button gradient-blue" type="submit">
            {editing ? "Update" : "Add"}
          </button>

          {editing && (
            <button
              className="button cancel-btn"
              type="button"
              onClick={() => {
                setEditing(null);
                setPatientForm({
                  name: "",
                  age: "",
                  gender: "",
                  condition: "",
                });
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ===== PATIENT LIST ===== */}
      {loading ? (
        <div className="premium-card" style={{ textAlign: "center" }}>
          Loading...
        </div>
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
            {patients.length > 0 ? (
              patients.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td>{p.condition}</td>
                  <td>
                    <button
                      className="button gradient-purple"
                      onClick={() => viewPatient(p)}
                    >
                      🔍
                    </button>
                    <button
                      className="button gradient-green"
                      onClick={() => startEdit(p)}
                      style={{ marginLeft: 6 }}
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* ===== PATIENT DETAILS ===== */}
      {selected && (
        <div className="premium-card details-card">
          <h3>Patient Details</h3>
          <p><strong>Name:</strong> {selected.name}</p>
          <p><strong>Age:</strong> {selected.age}</p>
          <p><strong>Gender:</strong> {selected.gender}</p>
          <p><strong>Condition:</strong> {selected.condition}</p>

          <h4>Vitals</h4>
          {selected.vitals?.length ? (
            <ul>
              {selected.vitals.map((v, i) => (
                <li key={i}>
                  {v.date && (
                    <strong>
                      {new Date(v.date).toLocaleString()}:
                    </strong>
                  )}{" "}
                  Temp: {v.temperature}, BP: {v.bloodPressure}, Pulse:{" "}
                  {v.pulse}
                </li>
              ))}
            </ul>
          ) : (
            <p>No vitals recorded.</p>
          )}

          <div className="form-buttons">
            <button
              className="button gradient-blue"
              onClick={() => setShowVitals(true)}
            >
              Add Vitals
            </button>
            <button
              className="button cancel-btn"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ===== ADD VITALS ===== */}
      {showVitals && selected && (
        <form onSubmit={submitVitals} className="card form-card">
          <h3>Add Vitals for {selected.name}</h3>

          <label>Temperature (°C)</label>
          <input
            value={vitalsForm.temperature}
            onChange={(e) =>
              setVitalsForm({
                ...vitalsForm,
                temperature: e.target.value,
              })
            }
            required
          />

          <label>Blood Pressure</label>
          <input
            value={vitalsForm.bloodPressure}
            onChange={(e) =>
              setVitalsForm({
                ...vitalsForm,
                bloodPressure: e.target.value,
              })
            }
            required
          />

          <label>Pulse</label>
          <input
            value={vitalsForm.pulse}
            onChange={(e) =>
              setVitalsForm({
                ...vitalsForm,
                pulse: e.target.value,
              })
            }
            required
          />

          <div className="form-buttons">
            <button className="button gradient-purple" type="submit">
              💾 Save Vitals
            </button>
            <button
              className="button cancel-btn"
              type="button"
              onClick={() => setShowVitals(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
