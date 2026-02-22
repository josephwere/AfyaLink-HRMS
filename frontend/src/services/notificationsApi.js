import apiFetch from "../utils/apiFetch";

export const listNotifications = async ({ query } = {}) => {
  return apiFetch(`/api/notifications/list${query ? `?${query}` : ""}`);
};

export const markNotificationRead = async (id) => {
  return apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
};

export const markNotificationUnread = async (id) => {
  return apiFetch(`/api/notifications/${id}/unread`, { method: "PUT" });
};

export const markAllNotificationsRead = async () => {
  return apiFetch("/api/notifications/read-all", { method: "PUT" });
};

export const listNotificationsFiltered = async ({ category, read } = {}) => {
  const params = new URLSearchParams();
  if (category && category !== "ALL") params.set("category", category);
  if (read === "true" || read === "false") params.set("read", read);
  const query = params.toString();
  return apiFetch(`/api/notifications/list${query ? `?${query}` : ""}`);
};
