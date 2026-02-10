import api from "./api";

export const createAdmin = (data) =>
  api.post("/api/admin/create", data);
