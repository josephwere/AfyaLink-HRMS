import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

function readChw(path) {
  return guardedConsoleFetch(path, { warmupKey: "chw" }).then(({ payload }) => payload);
}

export const getChwDashboard = () => readChw("/api/chw/dashboard");

export const listChwHouseholds = (q = "") =>
  readChw(`/api/chw/households${q ? `?q=${encodeURIComponent(q)}` : ""}`);

export const createChwHousehold = (payload) =>
  apiFetch("/api/chw/households", { method: "POST", body: payload });

export const addChwHouseholdMember = (householdId, payload) =>
  apiFetch(`/api/chw/households/${householdId}/members`, { method: "POST", body: payload });

export const recordChwFieldVisit = (householdId, payload) =>
  apiFetch(`/api/chw/households/${householdId}/visits`, { method: "POST", body: payload });

export const listChwFieldVisits = (category = "") =>
  readChw(`/api/chw/visits${category ? `?category=${encodeURIComponent(category)}` : ""}`);

export const createChwMaternal = (payload) =>
  apiFetch("/api/chw/maternal", { method: "POST", body: payload });

export const createChwChildGrowth = (payload) =>
  apiFetch("/api/chw/child-growth", { method: "POST", body: payload });

export const createChwVaccination = (payload) =>
  apiFetch("/api/chw/vaccinations", { method: "POST", body: payload });

export const createChwChronic = (payload) =>
  apiFetch("/api/chw/chronic", { method: "POST", body: payload });

export const createChwDiseaseReport = (payload) =>
  apiFetch("/api/chw/disease-reports", { method: "POST", body: payload });

export const createChwReferral = (payload) =>
  apiFetch("/api/chw/referrals", { method: "POST", body: payload });

export const listChwReferrals = () => readChw("/api/chw/referrals");
export const listChwPerformance = () => readChw("/api/chw/performance");

export const createChwGeoLog = (payload) =>
  apiFetch("/api/chw/geo-logs", { method: "POST", body: payload });
