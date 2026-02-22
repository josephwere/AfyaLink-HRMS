import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { useLocation } from "react-router-dom";

export default function StaffManagement() {
  const { user } = useAuth();
  const location = useLocation();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  if (
    user?.role !== "HOSPITAL_ADMIN" &&
    user?.role !== "HR_MANAGER" &&
    user?.role !== "SUPER_ADMIN" &&
    user?.role !== "SYSTEM_ADMIN" &&
    user?.role !== "DEVELOPER"
  ) {
    return <p>🚫 Access denied</p>;
  }

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await apiFetch(`/api/users?${params.toString()}`);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : [];
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
          "COMMUNITY_HEALTH_WORKER",
        ].includes(u.role)
      );
      setStaff(staffOnly);
      setTotal(Number(res?.total || staffOnly.length));
    } catch {
      setMsg("Failed to load staff");
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const initialQ = qs.get("q") || "";
    if (initialQ) setQ(initialQ);
  }, [location.search]);

  const deactivate = async (id) => {
    try {
      setMsg(null);
      await apiFetch(`/api/users/${id}`, { method: "PATCH", body: { active: false } });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to deactivate staff account");
    }
  };

  const updateRole = async (id, role) => {
    try {
      setMsg(null);
      await apiFetch(`/api/users/${id}`, { method: "PATCH", body: { role } });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to update role");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Staff Management</h2>
          <p className="muted">Approve roles, deactivate accounts.</p>
        </div>
        <div className="welcome-actions">
          <input
            className="search-input"
            placeholder="Search worker name, email, phone, ID, role..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
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
                      <option value="COMMUNITY_HEALTH_WORKER">Community Health Worker</option>
                    </select>
                  </td>
                  <td>{s.active === false ? "Inactive" : "Active"}</td>
                  <td>
                    <button
                      type="button"
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
          <div className="pagination-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Prev
            </button>
            <span className="muted">
              Page {page} • {total} workers
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || page * limit >= total}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
