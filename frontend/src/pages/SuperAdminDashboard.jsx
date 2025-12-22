import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function SuperAdminDashboard() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  /* --------------------------------------------------
     LOAD HOSPITALS
  -------------------------------------------------- */
  const loadHospitals = async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await apiFetch("/api/hospitals");
      if (!res.ok) throw new Error("Failed to load hospitals");
      const data = await res.json();
      setHospitals(data);
    } catch (e) {
      setErr(e.message || "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  /* --------------------------------------------------
     CREATE / UPDATE HOSPITAL
  -------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const res = editingId
        ? await apiFetch(`/api/hospitals/${editingId}`, {
            method: "PUT",
            body: JSON.stringify(form),
          })
        : await apiFetch("/api/hospitals", {
            method: "POST",
            body: JSON.stringify(form),
          });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.msg || "Error saving hospital");
      }

      setForm({
        name: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
      setEditingId(null);
      loadHospitals();
    } catch (e) {
      setErr(e.message || "Error saving hospital");
    }
  };

  /* --------------------------------------------------
     EDIT
  -------------------------------------------------- */
  const handleEdit = (h) => {
    setEditingId(h._id);
    setForm({
      name: h.name || "",
      adminName: h.admin?.name || "",
      adminEmail: h.admin?.email || "",
      adminPassword: "",
    });
  };

  /* --------------------------------------------------
     DELETE
  -------------------------------------------------- */
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this hospital?")) return;

    setErr("");

    try {
      const res = await apiFetch(`/api/hospitals/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete hospital");
      }

      loadHospitals();
    } catch (e) {
      setErr(e.message || "Failed to delete hospital");
    }
  };

  return (
    <div className="premium-card">
      <h2>🏥 Super Admin Dashboard — Hospitals</h2>

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
          onChange={(e) =>
            setForm({ ...form, adminName: e.target.value })
          }
          required
        />

        <label>Admin Email</label>
        <input
          type="email"
          value={form.adminEmail}
          onChange={(e) =>
            setForm({ ...form, adminEmail: e.target.value })
          }
          required
        />

        <label>
          Admin Password {editingId && "(leave blank to keep current)"}
        </label>
        <input
          type="password"
          value={form.adminPassword}
          onChange={(e) =>
            setForm({ ...form, adminPassword: e.target.value })
          }
          required={!editingId}
        />

        <div className="form-buttons">
          <button className="button gradient-blue" type="submit">
            {editingId ? "Update" : "Create"}
          </button>

          {editingId && (
            <button
              type="button"
              className="button cancel-btn"
              onClick={() => {
                setEditingId(null);
                setForm({
                  name: "",
                  adminName: "",
                  adminEmail: "",
                  adminPassword: "",
                });
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
              <th>👤 Admin</th>
              <th>📧 Email</th>
              <th>⚙️ Actions</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.length > 0 ? (
              hospitals.map((h) => (
                <tr key={h._id}>
                  <td>{h.name}</td>
                  <td>{h.admin?.name}</td>
                  <td>{h.admin?.email}</td>
                  <td>
                    <button
                      className="button gradient-blue"
                      onClick={() => handleEdit(h)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="button gradient-red"
                      onClick={() => handleDelete(h._id)}
                      style={{ marginLeft: 6 }}
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No hospitals found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
