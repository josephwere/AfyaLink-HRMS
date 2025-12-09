import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Register from './Register';

export default function HospitalAdminDashboard({ api, token }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { loadStaff(); }, []);

  const loadStaff = async () => {
    setLoading(true); 
    setErr('');
    try {
      const res = await axios.get(`${api}/auth/users?hospital=true`, auth);
      setStaff(res.data);
    } catch {
      setErr('Failed to load staff');
    } finally { setLoading(false); }
  };

  const handleRegister = () => {
    setShowRegister(false); 
    setEditingStaff(null);
    loadStaff();
  };

  const handleEdit = (s) => {
    setEditingStaff(s);
    setShowRegister(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this staff member?")) return;
    try {
      await axios.delete(`${api}/auth/users/${id}`, auth);
      loadStaff();
    } catch {
      setErr("Failed to delete staff");
    }
  };

  return (
    <div className="premium-card">
      <h2>🏥 Hospital Admin – Staff Management</h2>
      {err && <p style={{ color: 'red' }}>{err}</p>}

      <button className="button gradient-blue" onClick={() => { setShowRegister(true); setEditingStaff(null); }}>
        ➕ Register Staff
      </button>

      {showRegister && (
        <Register
          onRegister={handleRegister}
          allowedRoles={['doctor', 'nurse', 'labtech']}
          toggleLogin={() => setShowRegister(false)}
          editingStaff={editingStaff} // Pass for editing existing staff
        />
      )}

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
            {staff.length > 0 ? staff.map(s => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>{s.role}</td>
                <td>
                  <button className="button gradient-blue" onClick={() => handleEdit(s)}>✏️ Edit</button>
                  <button className="button gradient-red" onClick={() => handleDelete(s._id)} style={{ marginLeft: 5 }}>🗑 Delete</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>No staff found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <style>{`
        .premium-card { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); padding: 24px; border-radius: 16px; margin-bottom: 24px; }
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
