import api from "./api";

export const triggerAction = async (action, meta = {}) => {
  const res = await api.post("/api/actions/trigger", {
    action,
    meta,
  });
  return res.data;
};
