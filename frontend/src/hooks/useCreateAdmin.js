import { useCallback, useEffect, useMemo, useState } from "react";
import {
  registerHospitalAdmin,
  registerSystemAdmin,
  registerSuperAssistant,
  registerDeveloper,
  registerGovernmentStaff,
  listHospitals,
} from "../services/superAdminApi";
import { showActionSuccessGuide } from "../components/ActionSuccessGuide";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getValidationMessages(form = {}) {
  const errors = {};
  const email = String(form.email || "").trim();
  const password = String(form.password || "").trim();
  const name = String(form.name || "").trim();

  if (!name) errors.name = "This field is required";
  if (!email) errors.email = "This field is required";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Email address is invalid";
  if (!password) errors.password = "This field is required";
  if (form.role === "HOSPITAL_ADMIN" && !String(form.hospitalId || "").trim()) {
    errors.hospitalId = "Select a hospital for this admin";
  }
  return errors;
}

export function useCreateAdmin({ actorRole = "", canCreateGlobalAdmins = false } = {}) {
  const [hospitals, setHospitals] = useState([]);
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "HOSPITAL_ADMIN",
    hospitalId: "",
    branch: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [message, setMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const canCreateSystemLevel = actorRole === "SUPER_ADMIN";
  const canCreateSuperAssistant = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";
  const canCreateGovernmentAdmin = canCreateGlobalAdmins || actorRole === "DEVELOPER";
  const canCreateGovernmentStaff = canCreateGlobalAdmins || actorRole === "DEVELOPER" || actorRole === "GOVERNMENT_ADMIN";

  useEffect(() => {
    if (!canCreateGlobalAdmins && form.role === "HOSPITAL_ADMIN") {
      setForm((prev) => ({ ...prev, role: "GOVERNMENT_REGULATOR" }));
    }
  }, [canCreateGlobalAdmins, form.role]);

  const loadHospitals = useCallback(async (q = "") => {
    setLoadingHospitals(true);
    try {
      const data = await listHospitals({ page: 1, limit: 1000, withoutAdmin: true, q: q || undefined });
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.hospitals)
        ? data.hospitals
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setHospitals(rows);
    } catch {
      setHospitals([]);
    } finally {
      setLoadingHospitals(false);
    }
  }, []);

  useEffect(() => {
    if (!canCreateGlobalAdmins) return;
    void loadHospitals("");
  }, [canCreateGlobalAdmins, loadHospitals]);

  useEffect(() => {
    if (!canCreateGlobalAdmins) return undefined;
    const t = setTimeout(() => {
      void loadHospitals(hospitalQuery.trim());
    }, 250);
    return () => clearTimeout(t);
  }, [canCreateGlobalAdmins, hospitalQuery, loadHospitals]);

  const filteredHospitals = useMemo(() => {
    const q = hospitalQuery.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter((h) => {
      const name = String(h?.name || "").toLowerCase();
      const code = String(h?.code || "").toLowerCase();
      const address = String(h?.address || "").toLowerCase();
      return name.includes(q) || code.includes(q) || address.includes(q);
    });
  }, [hospitals, hospitalQuery]);

  const selectedHospital = useMemo(() => hospitals.find((h) => String(h._id) === String(form.hospitalId)) || null, [hospitals, form.hospitalId]);

  const submit = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const validationErrors = getValidationMessages(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setMessage(Object.values(validationErrors)[0] || "Please complete the required fields.");
      setLoading(false);
      return;
    }
    setFieldErrors({});

    try {
      if (form.role === "SYSTEM_ADMIN") {
        if (!canCreateSystemLevel) {
          setMessage("Only Super Admin can create System Admin accounts.");
          return;
        }
        await registerSystemAdmin({ name: form.name, email: form.email, password: form.password });
        setMessage("✅ System admin created");
        showActionSuccessGuide({
          title: "Admin created",
          message: "System admin created successfully.",
          notificationTitle: "Admin created",
          notificationBody: "System admin created successfully.",
          notificationCategory: "ACCOUNT",
          tips: ["Review the new account security posture", "Assign the right operational access policies"],
        });
      } else if (form.role === "SUPER_ASSISTANT") {
        if (!canCreateSuperAssistant) {
          setMessage("Only Super Admin or System Admin can create Super Assistant accounts.");
          return;
        }
        await registerSuperAssistant({ name: form.name, email: form.email, password: form.password });
        setMessage("✅ Super assistant created");
        showActionSuccessGuide({
          title: "Admin created",
          message: "Super assistant created successfully.",
          notificationTitle: "Admin created",
          notificationBody: "Super assistant created successfully.",
          notificationCategory: "ACCOUNT",
          tips: ["Review the assistant role handoff", "Verify the correct channels and approvals"],
        });
      } else if (form.role === "DEVELOPER") {
        if (!canCreateSystemLevel) {
          setMessage("Only Super Admin can create Developer accounts.");
          return;
        }
        await registerDeveloper({ name: form.name, email: form.email, password: form.password });
        setMessage("✅ Developer created");
        showActionSuccessGuide({
          title: "Admin created",
          message: "Developer account created successfully.",
          notificationTitle: "Admin created",
          notificationBody: "Developer account created successfully.",
          notificationCategory: "ACCOUNT",
          tips: ["Review access scopes", "Confirm secure environment defaults"],
        });
      } else if (String(form.role || "").startsWith("GOVERNMENT_")) {
        if (form.role === "GOVERNMENT_ADMIN" && !canCreateGovernmentAdmin) {
          setMessage("Only founder, system admin, or developer can create Government Admin accounts.");
          return;
        }
        await registerGovernmentStaff({ name: form.name, email: form.email, password: form.password, role: form.role, agency: "Ministry of Health" });
        setMessage("✅ Government account created");
        showActionSuccessGuide({
          title: "Admin created",
          message: "Government account created successfully.",
          notificationTitle: "Admin created",
          notificationBody: "Government account created successfully.",
          notificationCategory: "ACCOUNT",
          tips: ["Review agency access", "Confirm approval and compliance routing"],
        });
      } else {
        await registerHospitalAdmin({ name: form.name, email: form.email, password: form.password, hospitalId: form.hospitalId, branch: form.branch });
        setMessage("✅ Hospital admin created");
        showActionSuccessGuide({
          title: "Admin created",
          message: "Hospital admin created successfully.",
          notificationTitle: "Admin created",
          notificationBody: "Hospital admin created successfully.",
          notificationCategory: "ACCOUNT",
          tips: ["Review hospital admin permissions", "Assign the right branch and escalation path"],
        });
      }
      setForm({ name: "", email: "", password: "", role: "HOSPITAL_ADMIN", hospitalId: "", branch: "" });
      setHospitalQuery("");
      await loadHospitals("");
    } catch (err) {
      setMessage(err?.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  }, [canCreateGovernmentAdmin, canCreateSuperAssistant, canCreateSystemLevel, form.branch, form.email, form.hospitalId, form.name, form.password, form.role, loadHospitals]);

  return {
    form,
    setForm,
    hospitals,
    hospitalQuery,
    setHospitalQuery,
    loading,
    loadingHospitals,
    message,
    fieldErrors,
    canCreateSystemLevel,
    canCreateSuperAssistant,
    canCreateGovernmentAdmin,
    canCreateGovernmentStaff,
    filteredHospitals,
    selectedHospital,
    loadHospitals,
    submit,
  };
}

export default useCreateAdmin;
