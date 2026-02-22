import apiFetch from "../utils/apiFetch";

export async function globalSearch(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.hospital) qs.set("hospital", params.hospital);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/search${query}`);
}
