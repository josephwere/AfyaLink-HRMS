import api from "./api";

export const listDlqItems = async () => {
  const res = await api.get("/api/integrations/dlq-inspect");
  return res.data;
};

export const retryDlqItem = async (id) => {
  const res = await api.post(`/api/integrations/dlq/${id}/retry`);
  return res.data;
};

export const updateDlqItem = async (id, data) => {
  const res = await api.put(`/api/integrations/dlq-inspect/${id}`, { data });
  return res.data;
};
