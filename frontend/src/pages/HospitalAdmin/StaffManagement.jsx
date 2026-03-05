import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { useLocation } from "react-router-dom";

const HOSPITAL_ADMIN_ROLE_OPTIONS = [
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "PATIENT",
  "GUEST",
];

const GLOBAL_ROLE_OPTIONS = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DEVELOPER",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "PATIENT",
  "GUEST",
];

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  SYSTEM_ADMIN: "System Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  HOSPITAL_ADMIN_ASSISTANT: "Hospital Admin Assistant",
  DEVELOPER: "Developer",
  DOCTOR: "Doctor",
  SURGEON: "Surgeon",
  NURSE: "Nurse",
  LAB_TECH: "Lab Tech",
  PHARMACIST: "Pharmacist",
  RADIOLOGIST: "Radiologist",
  THERAPIST: "Therapist",
  RECEPTIONIST: "Receptionist",
  SECURITY_ADMIN: "Security Admin",
  SECURITY_OFFICER: "Security Officer",
  HR_MANAGER: "HR Manager",
  PAYROLL_OFFICER: "Payroll Officer",
  COMMUNITY_HEALTH_WORKER: "Community Health Worker",
  PATIENT: "Patient",
  GUEST: "Guest",
};

const HOSPITAL_SCOPED_ROLES = new Set([
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
]);

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
  const normalizedRole = String(user?.role || "").toUpperCase();
  const isGlobalActor =
    normalizedRole === "SUPER_ADMIN" ||
    normalizedRole === "SYSTEM_ADMIN" ||
    normalizedRole === "DEVELOPER";
  const canChangeRole = normalizedRole !== "HR_MANAGER";
  const roleOptions = isGlobalActor ? GLOBAL_ROLE_OPTIONS : HOSPITAL_ADMIN_ROLE_OPTIONS;
  const [hospitalOptions, setHospitalOptions] = useState([]);
  const [hospitalByUser, setHospitalByUser] = useState({});

  if (
    user?.role !== "HOSPITAL_ADMIN" &&
    user?.role !== "HOSPITAL_ADMIN_ASSISTANT" &&
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
      const manageable = items.filter((u) => roleOptions.includes(String(u.role || "").toUpperCase()));
      setStaff(manageable);
      setHospitalByUser((prev) => {
        const next = { ...prev };
        manageable.forEach((u) => {
          if (!(u._id in next)) {
            next[u._id] = u.hospital || "";
          }
        });
        return next;
      });
      setTotal(Number(res?.total || manageable.length));
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

  useEffect(() => {
    if (!isGlobalActor) return;
    let mounted = true;
    apiFetch("/api/super-admin/hospitals?page=1&limit=1000")
      .then((res) => {
        if (!mounted) return;
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setHospitalOptions(items);
      })
      .catch(() => {
        if (mounted) setHospitalOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, [isGlobalActor]);

  const deactivate = async (id) => {
    try {
      setMsg(null);
      await apiFetch(`/api/users/${id}`, { method: "PATCH", body: { active: false } });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to deactivate staff account");
    }
  };

  const demoteToPatient = async (id) => {
    try {
      setMsg(null);
      await apiFetch(`/api/users/${id}/demote-to-patient`, {
        method: "PATCH",
        body: { reason: "Removed from hospital staffing roster" },
      });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to demote user to patient");
    }
  };

  const updateRole = async (id, role) => {
    try {
      setMsg(null);
      const normalizedTargetRole = String(role || "").toUpperCase();
      const selectedHospital = hospitalByUser[id] || "";
      const payload = { role };

      if (isGlobalActor && HOSPITAL_SCOPED_ROLES.has(normalizedTargetRole)) {
        if (!selectedHospital) {
          setMsg("Select a hospital before assigning hospital-scoped roles.");
          return;
        }
        payload.hospital = selectedHospital;
      }

      await apiFetch(`/api/users/${id}`, { method: "PATCH", body: payload });
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
          <p className="muted">Manage user roles across staff and patient accounts.</p>
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
        <h3>Users</h3>
        <div className="card">
          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                {isGlobalActor && <th>Hospital</th>}
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
                    {canChangeRole ? (
                      <select
                        value={s.role}
                        onChange={(e) => updateRole(s._id, e.target.value)}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role] || role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{ROLE_LABELS[s.role] || s.role}</span>
                    )}
                  </td>
                  {isGlobalActor && (
                    <td>
                      <select
                        value={hospitalByUser[s._id] || ""}
                        onChange={(e) =>
                          setHospitalByUser((prev) => ({
                            ...prev,
                            [s._id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">No hospital</option>
                        {hospitalOptions.map((h) => (
                          <option key={h._id} value={h._id}>
                            {h.name || h.code || h._id}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
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
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => demoteToPatient(s._id)}
                      disabled={String(s.role || "").toUpperCase() === "PATIENT"}
                    >
                      Remove & Demote
                    </button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={isGlobalActor ? 6 : 5}>No users found</td>
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
