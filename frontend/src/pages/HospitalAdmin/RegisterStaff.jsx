import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import PasswordInput from "../../components/PasswordInput";
import { normalizeRole } from "../../utils/normalizeRole";
import AccessDeniedCard from "../../components/AccessDeniedCard";
import { useHospitalAdminOperations } from "../../hooks/useHospitalAdminOperations";

export default function RegisterStaff() {
  const { user } = useAuth();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const location = useLocation();
  const { staffForm: form, setStaffForm: setForm, registerStaff, staffSaving: loading, staffMsg: msg } = useHospitalAdminOperations();

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
      "driver",
      "ambulance_driver",
      "mortuary_staff",
      "mortuary_manager",
      "maintenance_tech",
      "biomedical_technician",
      "housekeeping_staff",
      "kitchen_staff",
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
    actorRole !== "HOSPITAL_ADMIN" &&
    actorRole !== "HOSPITAL_ADMIN_ASSISTANT" &&
    actorRole !== "HR_MANAGER" &&
    actorRole !== "SUPER_ADMIN" &&
    actorRole !== "SYSTEM_ADMIN" &&
    actorRole !== "DEVELOPER"
  ) {
    return <AccessDeniedCard message="Only authorized workforce managers can register hospital staff." />;
  }

  const submit = async (e) => {
    e.preventDefault();
    await registerStaff({ ...form });
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
        <select
          value={form.department || ""}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        >
          <option value="">Select department</option>
          <option value="Cardiology">Cardiology</option>
          <option value="Dermatology">Dermatology</option>
          <option value="Emergency">Emergency</option>
          <option value="General Practice">General Practice</option>
          <option value="ICU">ICU</option>
          <option value="Laboratory">Laboratory</option>
          <option value="Oncology">Oncology</option>
          <option value="Orthopedics">Orthopedics</option>
          <option value="Pediatrics">Pediatrics</option>
          <option value="Pharmacy">Pharmacy</option>
          <option value="Radiology">Radiology</option>
          <option value="Surgery">Surgery</option>
          <option value="Administration">Administration</option>
          <option value="HR">HR</option>
          <option value="Finance">Finance</option>
          <option value="Security">Security</option>
          <option value="IT">IT</option>
          <option value="Operations">Operations</option>
          <option value="Other">Other</option>
        </select>
        <PasswordInput
          label=""
          value={form.password}
          required
          placeholder="Temporary password"
          autoComplete="new-password"
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
          <option value="driver">Driver</option>
          <option value="ambulance_driver">Ambulance Driver</option>
          <option value="mortuary_staff">Mortuary Staff</option>
          <option value="mortuary_manager">Mortuary Manager</option>
          <option value="maintenance_tech">Maintenance Tech</option>
          <option value="biomedical_technician">Biomedical Technician</option>
          <option value="housekeeping_staff">Housekeeping Staff</option>
          <option value="kitchen_staff">Kitchen Staff</option>
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
