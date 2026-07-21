import apiFetch from "../utils/apiFetch";

export const resetPassword = async ({ token, password }) =>
  apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
