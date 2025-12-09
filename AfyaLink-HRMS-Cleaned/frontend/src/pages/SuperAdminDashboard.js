import React, { useEffect, useState } from "react";
import axios from "axios";

export default function SuperAdminDashboard({ api, token }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", adminName: "", adminEmail: "", adminPassword: "" });
  const [editingId, setEditingId] = useState(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const loadHospitals = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.get(`${api}/hospitals`, auth);
      setHospitals(res.data);
    } catch (e) {
      setErr("Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Edit hospital
        await axios.put(`${api}/hospitals/${editingId}`, form, auth);
      } else {
        // Create hospital + admin
        await axios.post(`${api}/hospitals`, form, auth);
      }
      setForm({ name: "", adminName: "", adminEmail: "", adminPassword: "" });
      setEditingId(null);
      loadHospitals();
    } catch (err) {
      setErr(err.response?.data?.msg || "Error saving hospital");
    }
  };

  const handleEdit = (h) => {
    setEditingId(h._id);
    setForm({
      name: h.name,
      adminName: h.admin?.name || "",
      adminEmail: h.admin?.email || "",
      adminPassword: "",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this hospital?")) return;
    try {
      await axios.delete(`${api}/hospitals/${id}`, auth);
      loadHospitals();
    } catch {
      setErr("Failed to delete hospital");
    }
  };

  return (
    <div className="premium-card">
      <h2>🏥 Super Admin Dashboard – Hospitals</h2>
      {err && <p style={{ color: "red" }}>{err}</p>}

      {/* CREATE / EDIT FORM */}
      <form onSubmit={handleSubmit} className="card form-card">
        <h3>{editingId ? "✏️ Edit Hospital" : "➕ Add Hospital"}</h3>
        <label>Hospital Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <label>Admin Name</label>
        <input
          value={form.adminName}
          onChange={(e) => setForm({ ...form, adminName: e.target.value })}
          required
        />
        <label>Admin Email</label>
        <input
          type="email"
          value={form.adminEmail}
          onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          required
        />
        <label>Admin Password {editingId ? "(leave blank to keep current)" : ""}</label>
        <input
          type="password"
          value={form.adminPassword}
          onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
          required={!editingId}
        />

        <div className="form-buttons">
          <button className="button gradient-blue" type="submit">
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button
              className="button cancel-btn"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", adminName: "", adminEmail: "", adminPassword: "" });
              }}
            >
              ❌ Cancel
            </button>
          )}
        </div>
      </form>

      {/* HOSPITAL LIST */}
      {loading ? (
        <p>Loading hospitals...</p>
      ) : (
        <table className="table premium-table">
          <thead>
            <tr>
              <th>🏥 Name</th>
              <th>👤 Admin Name</th>
              <th>📧 Admin Email</th>
              <th>⚙️ Actions</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.length > 0 ? hospitals.map((h) => (
              <tr key={h._id}>
                <td>{h.name}</td>
                <td>{h.admin?.name}</td>
                <td>{h.admin?.email}</td>
                <td>
                  <button className="button gradient-blue" onClick={() => handleEdit(h)}>✏️ Edit</button>
                  <button
                    className="button gradient-red"
                    onClick={() => handleDelete(h._id)}
                    style={{ marginLeft: 5 }}
                  >
                    🗑 Delete
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>No hospitals found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <style>{`
        .premium-card { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); padding: 24px; border-radius: 16px; margin-bottom: 24px; }
        .form-card label { display:block; margin-top:10px; margin-bottom:4px; font-weight:500; }
        .form-card input { width:100%; padding:8px 10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px; }
        .form-buttons { display:flex; gap:10px; margin-top:12px; }
        .cancel-btn { background:#777; color:white; }
        .table { width:100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { padding: 12px 8px; text-align: left; }
        .table th { background: linear-gradient(135deg,#4f46e5,#06b6d4); color:#fff; }
        .table tr { transition: transform 0.2s, background 0.2s; }
        .table tr:hover { background: rgba(59,130,246,0.1); }
        .button { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-weight:600; }
        .gradient-blue { background: linear-gradient(135deg, #3b82f6, #1e40af); color:white; }
        .gradient-red { background: linear-gradient(135deg, #ef4444, #b91c1c); color:white; }
      `}</style>
    </div>
  );
                        }
