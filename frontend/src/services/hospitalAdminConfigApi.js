import { apiFetch } from "../utils/apiFetch";

export const getHospitalAdminConfig = async () => apiFetch("/api/hospital-admin/config");

export const saveHospitalCommerceConfig = async (payload) =>
  apiFetch("/api/hospital-admin/commerce-config", {
    method: "PUT",
    body: payload,
  });
