import apiFetch from "../utils/apiFetch";

export const extractDocument = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/ai/extract", {
    method: "POST",
    body: formData,
  });
};

export default { extractDocument };
