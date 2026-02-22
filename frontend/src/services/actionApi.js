import apiFetch from "../utils/apiFetch";

export const triggerAction = async (action, meta = {}) => {
  return apiFetch("/api/actions/trigger", {
    method: "POST",
    body: {
      action,
      meta,
    },
  });
};
