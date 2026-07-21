import { apiFetch } from "../../utils/apiFetch.js";

/**
 * Radiology Domain Commands
 * Write and action operations for radiology workflows.
 */

export async function submitStudy(payload) {
  return apiFetch("/api/radiology/studies", {
    method: "POST",
    body: payload,
  });
}

export async function approveStudy(studyId, payload = {}) {
  return apiFetch(`/api/radiology/studies/${studyId}/approve`, {
    method: "POST",
    body: payload,
  });
}

export async function rejectStudy(studyId, payload = {}) {
  return apiFetch(`/api/radiology/studies/${studyId}/reject`, {
    method: "POST",
    body: payload,
  });
}

export async function addImages(studyId, payload) {
  return apiFetch(`/api/radiology/studies/${studyId}/images`, {
    method: "POST",
    body: payload,
  });
}

export async function submitReport(studyId, payload) {
  return apiFetch(`/api/radiology/studies/${studyId}/report`, {
    method: "POST",
    body: payload,
  });
}

export async function markStudyComplete(studyId, payload = {}) {
  return apiFetch(`/api/radiology/studies/${studyId}/complete`, {
    method: "POST",
    body: payload,
  });
}
