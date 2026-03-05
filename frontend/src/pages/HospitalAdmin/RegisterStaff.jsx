import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";

export default function RegisterStaff() {
  const { user } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "doctor",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  React.useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const role = String(qs.get("role") || "").toLowerCase();
    const allowed = new Set([
      "doctor",
      "hospital_admin_assistant",
      "nurse",
      "lab_tech",
      "pharmacist",
      "radiologist",
      "therapist",
      "receptionist",
      "security_officer",
      "hr_manager",
      "payroll_officer",
      "community_health_worker",
    ]);
    if (allowed.has(role)) {
      setForm((prev) => ({ ...prev, role }));
    }
  }, [location.search]);

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

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await apiFetch("/api/hospital-admin/register-staff", {
        method: "POST",
        body: form,
      });
      setMsg(res?.msg || "✅ Staff registered");
      setForm({ name: "", email: "", password: "", role: "doctor" });
    } catch (err) {
      setMsg(err?.message || "Failed to register staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Register Hospital Staff</h2>
          <p className="muted">
            Add staff members to your hospital workforce.
          </p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <form className="card form" onSubmit={submit}>
        <input
          placeholder="Full name"
          value={form.name}
          required
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Email address"
          type="email"
          value={form.email}
          required
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Temporary password"
          type="password"
          value={form.password}
          required
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="hospital_admin_assistant">Hospital Admin Assistant</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="lab_tech">Lab Tech</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="radiologist">Radiologist</option>
          <option value="therapist">Therapist</option>
          <option value="receptionist">Receptionist</option>
          <option value="security_officer">Security Officer</option>
          <option value="hr_manager">HR Manager</option>
          <option value="payroll_officer">Payroll Officer</option>
          <option value="community_health_worker">Community Health Worker</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Register Staff"}
        </button>
      </form>
    </div>
  );
}
