import apiFetch from "../utils/apiFetch";

export const listDlqItems = async () => {
  return apiFetch("/api/integrations/dlq-inspect");
};

export const retryDlqItem = async (id) => {
  return apiFetch(`/api/integrations/dlq/${id}/retry`, {
    method: "POST",
  });
};

export const updateDlqItem = async (id, data) => {
  return apiFetch(`/api/integrations/dlq-inspect/${id}`, {
    method: "PUT",
    body: { data },
  });
};
