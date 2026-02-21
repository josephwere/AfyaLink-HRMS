import apiFetch from "../utils/apiFetch";

export const runStaffingForecast = async (payload) =>
  apiFetch("/api/ml/staffing/forecast", { method: "POST", body: payload });

export const runBurnoutScore = async (payload) =>
  apiFetch("/api/ml/burnout/score", { method: "POST", body: payload });

export const runCausalImpact = async (payload) =>
  apiFetch("/api/ml/causal/impact", { method: "POST", body: payload });

export const runDigitalTwin = async (payload) =>
  apiFetch("/api/ml/digital-twin/simulate", { method: "POST", body: payload });

