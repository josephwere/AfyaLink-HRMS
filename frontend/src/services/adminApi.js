import apiFetch from "../utils/apiFetch";

export const createAdmin = (data) =>
  apiFetch("/api/admin/create-admin", {
    method: "POST",
    body: data,
  });
