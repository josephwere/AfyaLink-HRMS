import { apiFetch } from "../utils/apiFetch";

export const getPaymentSettings = async () => apiFetch("/api/payment-settings/get");
export const savePaymentSettings = async (payload) =>
  apiFetch("/api/payment-settings/save", {
    method: "POST",
    body: payload,
  });
export const requestPaymentSettingsOtp = async () =>
  apiFetch("/api/payment-settings/reveal/request", { method: "POST" });
export const verifyPaymentSettingsOtp = async ({ code, adminPassword }) =>
  apiFetch("/api/payment-settings/reveal/verify", {
    method: "POST",
    body: { code, adminPassword },
  });
export const rotatePaymentSettingsPassword = async ({ oldPassword, newPassword }) =>
  apiFetch("/api/payment-settings/rotate-password", {
    method: "POST",
    body: { oldPassword, newPassword },
  });
