import React, { useMemo } from "react";
import { useAuth } from "../../utils/auth";
import { useLocation } from "react-router-dom";
import { normalizeRole } from "../../utils/normalizeRole";
import AccessDeniedCard from "../../components/AccessDeniedCard";
import { useHospitalAdminOperations } from "../../hooks/useHospitalAdminOperations";

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
  "DRIVER",
  "AMBULANCE_DRIVER",
  "MORTUARY_STAFF",
  "MORTUARY_MANAGER",
  "MAINTENANCE_TECH",
  "BIOMEDICAL_TECHNICIAN",
  "HOUSEKEEPING_STAFF",
  "KITCHEN_STAFF",
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
  "DRIVER",
  "AMBULANCE_DRIVER",
  "MORTUARY_STAFF",
  "MORTUARY_MANAGER",
  "MAINTENANCE_TECH",
  "BIOMEDICAL_TECHNICIAN",
  "HOUSEKEEPING_STAFF",
  "KITCHEN_STAFF",
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
  DRIVER: "Driver",
  AMBULANCE_DRIVER: "Ambulance Driver",
  MORTUARY_STAFF: "Mortuary Staff",
  MORTUARY_MANAGER: "Mortuary Manager",
  MAINTENANCE_TECH: "Maintenance Tech",
  BIOMEDICAL_TECHNICIAN: "Biomedical Technician",
  HOUSEKEEPING_STAFF: "Housekeeping Staff",
  KITCHEN_STAFF: "Kitchen Staff",
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
  "DRIVER",
  "AMBULANCE_DRIVER",
  "MORTUARY_STAFF",
  "MORTUARY_MANAGER",
  "MAINTENANCE_TECH",
  "BIOMEDICAL_TECHNICIAN",
  "HOUSEKEEPING_STAFF",
  "KITCHEN_STAFF",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
]);

export default function StaffManagement() {
  const { user } = useAuth();
  const location = useLocation();
  const {
    staff,
    staffLoading: loading,
    staffMsg: msg,
    staffPage: page,
    setStaffPage: setPage,
    staffTotal: total,
    staffQuery: q,
    setStaffQuery: setQ,
    missingPharmacyOnly,
    setMissingPharmacyOnly,
    loadStaff,
    hospitalOptions,
    pharmacyOptions,
    staffSaving,
    staffForm,
    setStaffForm,
    registerStaff,
    deactivateStaff,
    demoteStaffToPatient,
    updateStaffRole,
  } = useHospitalAdminOperations();
  const normalizedRole = normalizeRole(user?.actualRole || user?.role);
  const isGlobalActor =
    normalizedRole === "SUPER_ADMIN" ||
    normalizedRole === "SYSTEM_ADMIN" ||
    normalizedRole === "DEVELOPER";
  const canChangeRole = normalizedRole !== "HR_MANAGER";
  const roleOptions = isGlobalActor ? GLOBAL_ROLE_OPTIONS : HOSPITAL_ADMIN_ROLE_OPTIONS;
  const [hospitalByUser, setHospitalByUser] = React.useState({});
  const [pharmacyByUser, setPharmacyByUser] = React.useState({});
  const pageSize = 20;

  if (
    normalizedRole !== "HOSPITAL_ADMIN" &&
    normalizedRole !== "HOSPITAL_ADMIN_ASSISTANT" &&
    normalizedRole !== "HR_MANAGER" &&
    normalizedRole !== "SUPER_ADMIN" &&
    normalizedRole !== "SYSTEM_ADMIN" &&
    normalizedRole !== "DEVELOPER"
  ) {
    return <AccessDeniedCard message="Staff management is restricted to authorized hospital and global admin roles." />;
  }

  React.useEffect(() => {
    if (!staff.length) return;
    setHospitalByUser((prev) => {
      const next = { ...prev };
      staff.forEach((u) => {
        if (!(u._id in next)) {
          next[u._id] = u.hospital || "";
        }
      });
      return next;
    });
    setPharmacyByUser((prev) => {
      const next = { ...prev };
      staff.forEach((u) => {
        if (!(u._id in next)) {
          next[u._id] = u.registeredPharmacy || "";
        }
      });
      return next;
    });
  }, [staff]);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      void loadStaff(1, q.trim(), missingPharmacyOnly);
    }, 300);
    return () => clearTimeout(id);
  }, [q, missingPharmacyOnly, loadStaff]);

  const pharmacyNameById = pharmacyOptions.reduce((acc, item) => {
    acc[String(item._id)] = item.name;
    return acc;
  }, {});

  React.useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const initialQ = qs.get("q") || "";
    const initialMissingPharmacy = qs.get("missingRegisteredPharmacy") === "1";
    if (initialQ) setQ(initialQ);
    if (initialMissingPharmacy) setMissingPharmacyOnly(true);
  }, [location.search]);

  const deactivate = async (id) => {
    try {
      await deactivateStaff(id);
    } catch (err) {
      setMsg(err?.message || "Failed to deactivate staff account");
    }
  };

  const demoteToPatient = async (id) => {
    try {
      await demoteStaffToPatient(id);
    } catch (err) {
      setMsg(err?.message || "Failed to demote user to patient");
    }
  };

  const updateRole = async (id, role) => {
    try {
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

      if (normalizedTargetRole === "PHARMACIST") {
        payload.registeredPharmacy = pharmacyByUser[id] || null;
      } else {
        payload.registeredPharmacy = null;
      }

      await updateStaffRole(id, payload);
    } catch (err) {
      setMsg(err?.message || "Failed to update role");
    }
  };

  const saveAccess = async (staffUser) => {
    try {
      const normalizedTargetRole = String(staffUser?.role || "").toUpperCase();
      const payload = { role: normalizedTargetRole };
      if (isGlobalActor && HOSPITAL_SCOPED_ROLES.has(normalizedTargetRole)) {
        const selectedHospital = hospitalByUser[staffUser._id] || "";
        if (!selectedHospital) {
          setMsg("Select a hospital before saving hospital-scoped access.");
          return;
        }
        payload.hospital = selectedHospital;
      }
      payload.registeredPharmacy =
        normalizedTargetRole === "PHARMACIST" ? pharmacyByUser[staffUser._id] || null : null;
      await updateStaffRole(staffUser._id, payload);
      setMsg("Staff access updated.");
    } catch (err) {
      setMsg(err?.message || "Failed to save staff access.");
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
          <button
            type="button"
            className={`btn-secondary ${missingPharmacyOnly ? "active" : ""}`}
            onClick={() => {
              setPage(1);
              setMissingPharmacyOnly((prev) => !prev);
            }}
          >
            {missingPharmacyOnly ? "Show All Staff" : "Show Unlinked Pharmacists"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void loadStaff(1, q.trim(), missingPharmacyOnly)} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Users</h3>
        <div className="card">
          <div className="welcome-actions mb-12">
            <div className="action-pill">
              Unlinked pharmacists: {staff.filter((item) => String(item.role || "").toUpperCase() === "PHARMACIST" && !pharmacyByUser[item._id]).length}
            </div>
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                {isGlobalActor && <th>Hospital</th>}
                <th>Pharmacy Link</th>
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
                  <td>
                    {String(s.role || "").toUpperCase() === "PHARMACIST" ? (
                      <div>
                        <select
                          value={pharmacyByUser[s._id] || ""}
                          onChange={(e) =>
                            setPharmacyByUser((prev) => ({
                              ...prev,
                              [s._id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">No pharmacy</option>
                          {pharmacyOptions.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {pharmacyByUser[s._id]
                            ? pharmacyNameById[String(pharmacyByUser[s._id])] || "Linked pharmacy"
                            : "Not linked"}
                        </div>
                      </div>
                    ) : (
                      <span className="muted">Not needed</span>
                    )}
                  </td>
                  <td>{s.active === false ? "Inactive" : "Active"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => saveAccess(s)}
                    >
                      Save Access
                    </button>
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
                  <td colSpan={isGlobalActor ? 7 : 6}>No users found</td>
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
              disabled={loading || page * pageSize >= total}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
