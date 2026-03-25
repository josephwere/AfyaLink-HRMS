import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

export async function listRegisteredPharmacies(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  });
  return apiFetch(`/api/pharmacy-network/pharmacies?${qs.toString()}`);
}

export async function createRegisteredPharmacy(payload) {
  return apiFetch("/api/pharmacy-network/pharmacies", {
    method: "POST",
    body: payload,
  });
}

export async function updateRegisteredPharmacy(id, payload) {
  return apiFetch(`/api/pharmacy-network/pharmacies/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function listPharmacyReferrals(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  });
  const result = await guardedConsoleFetch(`/api/pharmacy-network/referrals?${qs.toString()}`, {
    warmupKey: "pharmacy-referrals",
  });
  return result?.payload || null;
}

export async function createPharmacyReferral(payload) {
  return apiFetch("/api/pharmacy-network/referrals", {
    method: "POST",
    body: payload,
  });
}

export async function updatePharmacyReferral(id, payload) {
  return apiFetch(`/api/pharmacy-network/referrals/${id}`, {
    method: "PATCH",
    body: payload,
  });
}
