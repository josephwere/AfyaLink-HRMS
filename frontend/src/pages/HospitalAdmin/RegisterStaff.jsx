import React, { useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../utils/auth";

export default function RegisterStaff() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "doctor",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  if (user?.role !== "HOSPITAL_ADMIN") {
    return <p>🚫 Access denied</p>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.post("/api/hospital-admin/register-staff", form);
      setMsg(res.data?.msg || "✅ Staff registered");
      setForm({ name: "", email: "", password: "", role: "doctor" });
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to register staff");
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
        </select>
        <button disabled={loading}>
          {loading ? "Creating..." : "Register Staff"}
        </button>
      </form>
    </div>
  );
}
