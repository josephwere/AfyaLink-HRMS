import apiFetch from "../utils/apiFetch";

export const getSystemSettings = async () => {
  return apiFetch("/api/system-settings");
};

export const getSystemSettingsHistory = async () => {
  return apiFetch("/api/system-settings/history");
};

export const restoreSystemSettingsRevision = async (revisionId) => {
  return apiFetch(`/api/system-settings/restore/${revisionId}`, {
    method: "POST",
  });
};

export const getEmailDeliveryHealth = async () => {
  return apiFetch("/api/system-settings/email-health");
};

export const getAssetDeliveryHealth = async () => {
  return apiFetch("/api/system-settings/asset-health");
};

export const updateSystemSettings = async (data) => {
  return apiFetch("/api/system-settings", {
    method: "PUT",
    body: data,
  });
};
