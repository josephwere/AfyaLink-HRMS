import { apiFetch } from "../../utils/apiFetch.js";

/**
 * Laboratory Domain Queries
 * Read-only operations for laboratory tests, samples, and results.
 */

export async function listTests({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const query = new URLSearchParams({ q, page, limit, status }).toString();
  return apiFetch(`/api/laboratory/tests?${query}`);
}

export async function getTest(id) {
  return apiFetch(`/api/laboratory/tests/${id}`);
}

export async function getResults(testId) {
  return apiFetch(`/api/laboratory/tests/${testId}/results`);
}

export async function searchTests(searchTerm) {
  const query = new URLSearchParams({ q: searchTerm }).toString();
  return apiFetch(`/api/laboratory/tests/search?${query}`);
}

export async function listSamples({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const query = new URLSearchParams({ q, page, limit, status }).toString();
  return apiFetch(`/api/laboratory/samples?${query}`);
}

export async function getSample(id) {
  return apiFetch(`/api/laboratory/samples/${id}`);
}

export async function listLabResults() {
  return apiFetch("/api/labs");
}
