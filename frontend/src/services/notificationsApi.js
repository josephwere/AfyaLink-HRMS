import api from "./api";

export const listNotifications = async ({ query } = {}) => {
  const res = await api.get(`/api/notifications/list${query ? `?${query}` : ""}`);
  return res.data;
};

export const markNotificationRead = async (id) => {
  const res = await api.put(`/api/notifications/${id}/read`);
  return res.data;
};

export const markNotificationUnread = async (id) => {
  const res = await api.put(`/api/notifications/${id}/unread`);
  return res.data;
};

export const markAllNotificationsRead = async () => {
  const res = await api.put("/api/notifications/read-all");
  return res.data;
};

export const listNotificationsFiltered = async ({ category, read } = {}) => {
  const params = new URLSearchParams();
  if (category && category !== "ALL") params.set("category", category);
  if (read === "true" || read === "false") params.set("read", read);
  const query = params.toString();
  const res = await api.get(`/api/notifications/list${query ? `?${query}` : ""}`);
  return res.data;
};
