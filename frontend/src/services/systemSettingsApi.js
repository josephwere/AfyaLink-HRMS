import apiFetch from "../utils/apiFetch";

export const getSystemSettings = async () => {
  return apiFetch("/api/system-settings");
};

export const getEmailDeliveryHealth = async () => {
  return apiFetch("/api/system-settings/email-health");
};

export const updateSystemSettings = async (data) => {
  return apiFetch("/api/system-settings", {
    method: "PUT",
    body: data,
  });
};
