import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../utils/auth";

export default function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  if (user?.role !== "HOSPITAL_ADMIN" && user?.role !== "SUPER_ADMIN") {
    return <p>🚫 Access denied</p>;
  }

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.get("/api/users");
      const items = res.data || [];
      const staffOnly = items.filter((u) =>
        [
          "HOSPITAL_ADMIN",
          "DOCTOR",
          "NURSE",
          "LAB_TECH",
          "PHARMACIST",
          "RADIOLOGIST",
          "THERAPIST",
          "RECEPTIONIST",
          "SECURITY_OFFICER",
          "HR_MANAGER",
          "PAYROLL_OFFICER",
        ].includes(u.role)
      );
      setStaff(staffOnly);
    } catch {
      setMsg("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deactivate = async (id) => {
    await api.patch(`/api/users/${id}`, { active: false });
    load();
  };

  const updateRole = async (id, role) => {
    await api.patch(`/api/users/${id}`, { role });
    load();
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Staff Management</h2>
          <p className="muted">Approve roles, deactivate accounts.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Staff</h3>
        <div className="card">
          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    <select
                      value={s.role}
                      onChange={(e) => updateRole(s._id, e.target.value)}
                    >
                      <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                      <option value="DOCTOR">Doctor</option>
                      <option value="NURSE">Nurse</option>
                      <option value="LAB_TECH">Lab Tech</option>
                      <option value="PHARMACIST">Pharmacist</option>
                      <option value="RADIOLOGIST">Radiologist</option>
                      <option value="THERAPIST">Therapist</option>
                      <option value="RECEPTIONIST">Receptionist</option>
                      <option value="SECURITY_OFFICER">Security Officer</option>
                      <option value="HR_MANAGER">HR Manager</option>
                      <option value="PAYROLL_OFFICER">Payroll Officer</option>
                    </select>
                  </td>
                  <td>{s.active === false ? "Inactive" : "Active"}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => deactivate(s._id)}
                      disabled={s.active === false}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan="5">No staff found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
