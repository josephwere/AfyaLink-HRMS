import { apiFetch } from "../utils/apiFetch";

export const loginWithPassword = async ({ identifier, password }) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: { identifier, password },
  });

export const requestPasswordReset = async ({ email }) =>
  apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
  });

export const requestPhoneResetCode = async ({ phone }) =>
  apiFetch("/api/auth/forgot-password/phone/request-otp", {
    method: "POST",
    body: { phone },
  });

export const submitPhoneReset = async ({ phone, otp, password }) =>
  apiFetch("/api/auth/reset-password/phone", {
    method: "POST",
    body: { phone, otp, password },
  });

export const verifyTwoFactor = async ({ userId, otp }) =>
  apiFetch("/api/auth/2fa/verify", {
    method: "POST",
    body: { userId, otp },
  });

export const resendTwoFactorCode = async ({ userId }) =>
  apiFetch("/api/auth/2fa/resend", {
    method: "POST",
    body: { userId },
  });

export const verifyEmailToken = async (token) =>
  apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);

export const resendVerificationEmail = async (email) =>
  apiFetch("/api/auth/resend-verification", {
    method: "POST",
    body: { email },
  });

export const verifyAdminUser = async (userId) =>
  apiFetch(`/api/auth/admin/verify-user/${userId}`, {
    method: "POST",
  });
