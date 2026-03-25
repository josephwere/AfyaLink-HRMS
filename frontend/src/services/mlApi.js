import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

export const runStaffingForecast = async (payload) =>
  guardedConsoleFetch("/api/ml/staffing/forecast", {
    warmupKey: "ml-staffing-forecast",
    requestOptions: { method: "POST", body: payload },
    timeoutSequence: [28000, 42000],
  }).then((result) => result?.payload || null);

export const runBurnoutScore = async (payload) =>
  guardedConsoleFetch("/api/ml/burnout/score", {
    warmupKey: "ml-burnout-score",
    requestOptions: { method: "POST", body: payload },
    timeoutSequence: [22000, 32000],
  }).then((result) => result?.payload || null);

export const runCausalImpact = async (payload) =>
  guardedConsoleFetch("/api/ml/causal/impact", {
    warmupKey: "ml-causal-impact",
    requestOptions: { method: "POST", body: payload },
    timeoutSequence: [22000, 32000],
  }).then((result) => result?.payload || null);

export const runDigitalTwin = async (payload) =>
  guardedConsoleFetch("/api/ml/digital-twin/simulate", {
    warmupKey: "ml-digital-twin",
    requestOptions: { method: "POST", body: payload },
    timeoutSequence: [28000, 42000],
  }).then((result) => result?.payload || null);
