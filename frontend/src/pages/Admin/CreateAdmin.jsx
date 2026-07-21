import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import DismissibleCardSection from "../../components/DismissibleCardSection";
import PasswordInput from "../../components/PasswordInput";
import { normalizeRole } from "../../utils/normalizeRole";
import AccessDeniedCard from "../../components/AccessDeniedCard";
import { useCreateAdmin } from "../../hooks/useCreateAdmin";

export default function CreateAdmin() {
  const { user } = useAuth();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const {
    form,
    setForm,
    hospitals,
    hospitalQuery,
    setHospitalQuery,
    loading,
    loadingHospitals,
    message,
    canCreateSystemLevel,
    canCreateSuperAssistant,
    canCreateGovernmentAdmin,
    canCreateGovernmentStaff,
    filteredHospitals,
    selectedHospital,
    submit,
  } = useCreateAdmin({ actorRole, canCreateGlobalAdmins: actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN" });

  const canCreateGlobalAdmins = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";
  const canCreateAdmins = canCreateGlobalAdmins || canCreateGovernmentStaff;

  if (!canCreateAdmins) {
    return <AccessDeniedCard message="Only founder, system admin, developer, or government admin roles can create accounts from this screen." />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submit();
  };

  return (
    <div className="card">
      <h2>👤 Create Admin</h2>
      <div className="welcome-actions" style={{ marginBottom: 12 }}>
        <Link to="/admin/super-assistants">Manage Super Assistants</Link>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <DismissibleCardSection title="Admin Identity">
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
            {canCreateGlobalAdmins && <option value="HOSPITAL_ADMIN">Hospital Admin</option>}
            {canCreateSuperAssistant && (
              <option value="SUPER_ASSISTANT">Super Assistant (Human)</option>
            )}
            {canCreateSystemLevel && <option value="SYSTEM_ADMIN">System Admin</option>}
            {canCreateSystemLevel && <option value="DEVELOPER">Developer</option>}
            {canCreateGovernmentAdmin && <option value="GOVERNMENT_ADMIN">Government Admin</option>}
            {canCreateGovernmentStaff && <option value="GOVERNMENT_REGULATOR">Government Regulator</option>}
            {canCreateGovernmentStaff && <option value="GOVERNMENT_AUDITOR">Government Auditor</option>}
            {canCreateGovernmentStaff && <option value="GOVERNMENT_INSPECTOR">Government Inspector</option>}
            {canCreateGovernmentStaff && <option value="GOVERNMENT_ANALYST">Government Analyst</option>}
          </select>
        </DismissibleCardSection>

        {canCreateGlobalAdmins && form.role === "HOSPITAL_ADMIN" && (
          <DismissibleCardSection title="Hospital Assignment (No Admin Yet)">
            <input
              placeholder="Global search: hospital name, code, address"
              value={hospitalQuery}
              onChange={(e) => setHospitalQuery(e.target.value)}
            />

            <select
              value={form.hospitalId}
              onChange={(e) => {
                const hospitalId = e.target.value;
                setForm({ ...form, hospitalId });
              }}
              required
            >
              <option value="">
                {loadingHospitals
                  ? "Loading hospitals..."
                  : filteredHospitals.length
                  ? "Select latest hospital without admin"
                  : "No hospitals without admin found"}
              </option>
              {filteredHospitals.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} {h.code ? `(${h.code})` : ""}
                </option>
              ))}
            </select>

            {selectedHospital && (
              <p className="muted" style={{ marginTop: 6 }}>
                Selected: {selectedHospital.name}
                {selectedHospital.address ? ` • ${selectedHospital.address}` : ""}
              </p>
            )}

            <input
              placeholder="Branch (optional, e.g. Kisumu Branch)"
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
            />
          </DismissibleCardSection>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
