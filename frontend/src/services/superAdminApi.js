import apiFetch from "../utils/apiFetch";

export const listHospitals = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/super-admin/hospitals${query}`);
};

export const registerHospitalAdmin = async (data) => {
  return apiFetch("/api/super-admin/register-hospital-admin", {
    method: "POST",
    body: data,
  });
};

export const registerSystemAdmin = async (data) => {
  return apiFetch("/api/super-admin/register-system-admin", {
    method: "POST",
    body: data,
  });
};

export const registerSuperAssistant = async (data) => {
  return apiFetch("/api/super-admin/register-super-assistant", {
    method: "POST",
    body: data,
  });
};

export const registerDeveloper = async (data) => {
  return apiFetch("/api/super-admin/register-developer", {
    method: "POST",
    body: data,
  });
};

export const listHospitalAdmins = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/super-admin/hospital-admins${query}`);
};

export const updateHospitalAdmin = async (id, data) => {
  return apiFetch(`/api/super-admin/hospital-admins/${id}`, {
    method: "PATCH",
    body: data,
  });
};

export const listSuperAssistants = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/super-admin/super-assistants${query}`);
};

export const updateSuperAssistant = async (id, data) => {
  return apiFetch(`/api/super-admin/super-assistants/${id}`, {
    method: "PATCH",
    body: data,
  });
};

export const bulkUpdateSuperAssistants = async (data) => {
  return apiFetch("/api/super-admin/super-assistants/bulk-actions", {
    method: "POST",
    body: data,
  });
};

export const sendSuperAssistantResetLink = async (id) => {
  return apiFetch(`/api/super-admin/super-assistants/${id}/send-reset-link`, {
    method: "POST",
  });
};
