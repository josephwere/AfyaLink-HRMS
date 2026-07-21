import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

export const getCurrentProfile = async () => apiFetch("/api/profile");

export const updateCurrentProfilePreferences = async (preferences) =>
  apiFetch("/api/profile", {
    method: "PUT",
    body: { uiPreferences: preferences },
  });

export const loadProfileWorkspace = async (options = {}) =>
  guardedConsoleFetch("/api/profile", options);

export const updateProfileSection = async (payload) =>
  apiFetch("/api/profile", {
    method: "PUT",
    body: payload,
  });

export const saveFamilyPreferences = async (payload) =>
  apiFetch("/api/profile", {
    method: "PUT",
    body: payload,
  });

export const getFamilyMonitoring = async () => apiFetch("/api/profile/family");

export const searchFamilyProfiles = async ({ q, dob }) =>
  apiFetch(`/api/profile/family/search?q=${encodeURIComponent(q)}&dob=${encodeURIComponent(dob)}`);

export const linkFamilyMinor = async ({ patientId, relationship, notes }) =>
  apiFetch("/api/profile/family/minors/link", {
    method: "POST",
    body: { patientId, relationship, notes },
  });

export const unlinkFamilyMinor = async (patientId) =>
  apiFetch(`/api/profile/family/minors/${patientId}`, {
    method: "DELETE",
  });

export const toggleTwoFactor = async ({ enabled }) =>
  apiFetch("/api/2fa/toggle", {
    method: "POST",
    body: { enabled },
  });

export const setupTotp = async () => apiFetch("/api/2fa/setup-totp", { method: "POST" });

export const verifyTotp = async ({ code }) =>
  apiFetch("/api/2fa/verify-totp", {
    method: "POST",
    body: { code },
  });

export const disableTotp = async ({ code }) =>
  apiFetch("/api/2fa/disable", {
    method: "POST",
    body: { code },
  });

export const resendVerificationEmail = async ({ email }) =>
  apiFetch("/api/auth/resend-verification", {
    method: "POST",
    body: { email },
  });

export const updateProfileField = async (payload) =>
  apiFetch("/api/profile", {
    method: "PUT",
    body: payload,
  });

export const requestPhoneOtp = async ({ phone }) =>
  apiFetch("/api/auth/phone/request-otp", {
    method: "POST",
    body: { phone },
  });

export const verifyPhoneOtp = async ({ otp }) =>
  apiFetch("/api/auth/phone/verify", {
    method: "POST",
    body: { otp },
  });

export const changePassword = async (payload) =>
  apiFetch("/api/auth/change-password", {
    method: "POST",
    body: payload,
  });

export const exportAccountData = async () => apiFetch("/api/profile/export", { _skipUiProgress: true });

export const deleteAccount = async ({ confirmText, currentPassword }) =>
  apiFetch("/api/profile/delete-account", {
    method: "POST",
    body: { confirmText, currentPassword },
  });
