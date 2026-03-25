import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

export const runStaffingForecast = async (payload) =>
  guardedConsoleFetch("/api/ml/staffing/forecast", {
    warmupKey: "ml-staffing-forecast",
    requestOptions: { method: "POST", body: payload },
    timeoutSequence: [28000, 42000],
  }).then((result) => result?.payload || null);

export const runBurnoutScore = async (payload) =>
  apiFetch("/api/ml/burnout/score", { method: "POST", body: payload });

export const runCausalImpact = async (payload) =>
  apiFetch("/api/ml/causal/impact", { method: "POST", body: payload });

export const runDigitalTwin = async (payload) =>
  apiFetch("/api/ml/digital-twin/simulate", { method: "POST", body: payload });
