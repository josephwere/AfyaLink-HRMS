import apiFetch from "../utils/apiFetch";

const buildDraftPath = (draftType, patientId, promote = false) => {
  if (!draftType) throw new Error("draftType is required");
  if (!patientId) throw new Error("patientId is required");
  const encodedPatientId = encodeURIComponent(patientId);
  const basePath = `/api/clinical-drafts/${encodeURIComponent(draftType)}?patientId=${encodedPatientId}`;
  return promote ? `${basePath}/promote` : basePath;
};

export const getClinicalDraft = async (draftType, patientId) => {
  return apiFetch(buildDraftPath(draftType, patientId));
};

export const saveClinicalDraft = async (draftType, patientId, payload) => {
  return apiFetch(buildDraftPath(draftType, patientId), {
    method: "PUT",
    body: payload,
  });
};

export const promoteClinicalDraft = async (draftType, patientId) => {
  return apiFetch(buildDraftPath(draftType, patientId, true), {
    method: "POST",
  });
};

export default {
  getClinicalDraft,
  saveClinicalDraft,
  promoteClinicalDraft,
};
