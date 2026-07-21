import { apiFetch } from "../../utils/apiFetch.js";

/**
 * Radiology Domain Queries
 * Read-only operations for radiology studies, images, and reports.
 */

export async function listStudies({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const query = new URLSearchParams({ q, page, limit, status }).toString();
  return apiFetch(`/api/radiology/studies?${query}`);
}

export async function getStudy(id) {
  return apiFetch(`/api/radiology/studies/${id}`);
}

export async function getImages(studyId) {
  return apiFetch(`/api/radiology/studies/${studyId}/images`);
}

export async function searchStudies(searchTerm) {
  const query = new URLSearchParams({ q: searchTerm }).toString();
  return apiFetch(`/api/radiology/studies/search?${query}`);
}

export async function getReport(studyId) {
  return apiFetch(`/api/radiology/studies/${studyId}/report`);
}
