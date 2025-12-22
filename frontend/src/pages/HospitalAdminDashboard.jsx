import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import Register from "../Register";

export default function HospitalAdminDashboard() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  /* --------------------------------------------------
     LOAD STAFF
  -------------------------------------------------- */
  const loadStaff = async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await apiFetch("/api/auth/users?hospital=true");
      if (!res.ok) throw new Error("Failed to load staff");
      const data = await res.json();
      setStaff(data);
    } catch (e) {
      setErr(e.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  /* --------------------------------------------------
     AFTER REGISTER / UPDATE
  -------------------------------------------------- */
  const handleRegisterComplete = () => {
    setShowRegister(false);
    setEditingStaff(null);
    loadStaff();
  };

  /* --------------------------------------------------
     EDIT STAFF
  -------------------------------------------------- */
  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setShowRegister(true);
  };

  /* --------------------------------------------------
     DELETE STAFF
  -------------------------------------------------- */
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this staff member?"))
      return;

    setErr("");

    try {
      const res = await apiFetch(`/api/auth/users/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete staff");
      loadStaff();
    } catch (e) {
      setErr(e.message || "Failed to delete staff");
    }
  };

  return (
    <div className="premium-card">
      <h2>🏥 Hospital Admin — Staff Management</h2>

      {err && <p style={{ color: "red" }}>{err}</p>}

      <button
        className="button gradient-blue"
        onClick={() => {
          setShowRegister(true);
          setEditingStaff(null);
        }}
      >
        ➕ Register Staff
      </button>

      {/* REGISTER / EDIT STAFF */}
      {showRegister && (
        <Register
          onRegister={handleRegisterComplete}
          allowedRoles={["doctor", "nurse", "labtech"]}
          toggleLogin={() => setShowRegister(false)}
          editingStaff={editingStaff}
        />
      )}

      {/* STAFF LIST */}
      {loading ? (
        <p>Loading staff...</p>
      ) : (
        <table className="table premium-table">
          <thead>
            <tr>
              <th>👤 Name</th>
              <th>📧 Email</th>
              <th>🛠 Role</th>
              <th>⚙️ Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.length > 0 ? (
              staff.map((s) => (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.role}</td>
                  <td>
                    <button
                      className="button gradient-blue"
                      onClick={() => handleEdit(s)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="button gradient-red"
                      onClick={() => handleDelete(s._id)}
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
                  No staff found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* LOCAL STYLES */}
      <style>{`
        .premium-card {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(12px);
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 24px;
        }
        .table {
          width:100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .table th, .table td {
          padding: 12px 8px;
          text-align: left;
        }
        .table th {
          background: linear-gradient(135deg,#4f46e5,#06b6d4);
          color:#fff;
        }
        .table tr:hover {
          background: rgba(59,130,246,0.1);
        }
        .button {
          padding:8px 16px;
          border-radius:8px;
          border:none;
          cursor:pointer;
          font-weight:600;
        }
        .gradient-blue {
          background: linear-gradient(135deg, #3b82f6, #1e40af);
          color:white;
        }
        .gradient-red {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color:white;
        }
      `}</style>
    </div>
  );
}
