import apiFetch from "../utils/apiFetch";

export const listBackgroundJobs = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.queue) params.set("queue", options.queue);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiFetch(`/api/developer/background-jobs${query ? `?${query}` : ""}`);
};

export const retryBackgroundJob = async (id) =>
  apiFetch(`/api/developer/background-jobs/${id}/retry`, {
    method: "POST",
  });
