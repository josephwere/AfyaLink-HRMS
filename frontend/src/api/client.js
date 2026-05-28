import { fetchApi } from "../lib/api/client";

export async function apiFetch(path, options = {}) {
  return fetchApi(path, options);
}
