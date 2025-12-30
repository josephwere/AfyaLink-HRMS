import api from "./api";

export const createAdmin = (data) =>
  api.post("/admin/create", data);
