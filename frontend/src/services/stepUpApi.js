import apiFetch from "../utils/apiFetch";

export const getSessionRisk = async () => apiFetch("/api/auth/session-risk");

export const requestStepUpCode = async () =>
  apiFetch("/api/auth/step-up/request", { method: "POST" });

export const verifyStepUpCode = async (otp) =>
  apiFetch("/api/auth/step-up/verify", {
    method: "POST",
    body: { otp },
  });
