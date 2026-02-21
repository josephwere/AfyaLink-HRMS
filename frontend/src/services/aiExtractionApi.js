import api from "./api";

export const extractDocument = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/api/ai/extract", formData);
  return res.data;
};

export default { extractDocument };

