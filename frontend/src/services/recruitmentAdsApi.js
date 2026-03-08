import apiFetch from "../utils/apiFetch";

export const listRecruitmentAds = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      qs.set(key, String(value));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/recruitment-ads${query}`);
};

export const listRecruitmentApplications = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      qs.set(key, String(value));
    }
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/recruitment-ads/applications${query}`);
};

export const createRecruitmentAd = async (formData) =>
  apiFetch("/api/recruitment-ads", {
    method: "POST",
    body: formData,
  });

export const updateRecruitmentAd = async (id, formData) =>
  apiFetch(`/api/recruitment-ads/${id}`, {
    method: "PATCH",
    body: formData,
  });

export const updateRecruitmentApplicationStatus = async (applicationId, status) =>
  apiFetch(`/api/recruitment-ads/applications/${applicationId}/status`, {
    method: "PATCH",
    body: { status },
  });

export const applyToRecruitmentAd = async (id, payload) =>
  apiFetch(`/api/recruitment-ads/${id}/apply`, {
    method: "POST",
    body: payload,
  });

export const trackRecruitmentAdEvent = async (id, event) =>
  apiFetch(`/api/recruitment-ads/${id}/track`, {
    method: "POST",
    body: event,
  });
