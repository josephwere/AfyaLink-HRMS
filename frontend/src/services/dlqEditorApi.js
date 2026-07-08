import apiFetch from "../utils/apiFetch";

export const listDlq = async () => {
  return apiFetch("/api/integrations/dlq");
};

export const viewDlq = async (id) => {
  return apiFetch(`/api/integrations/dlq/${id}`);
};

export const editRetry = async (id, newData) => {
  return apiFetch(`/api/integrations/dlq/${id}/edit-retry`, {
    method: "POST",
    body: { newData },
  });
};
