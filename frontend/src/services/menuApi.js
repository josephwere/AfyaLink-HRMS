import apiFetch from "../utils/apiFetch";

export const fetchMenu = async () => {
  return apiFetch("/api/menu");
};
