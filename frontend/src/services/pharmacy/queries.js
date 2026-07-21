import { apiFetch } from "../../utils/apiFetch";

export async function listItems({ q, page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({ q, page, limit }).toString();
  return apiFetch(`/api/pharmacy?${query}`);
}

export async function listAvailableMedicines({ q = "", limit = 200, includeOutOfStock = false } = {}) {
  const query = new URLSearchParams({
    q,
    limit,
    includeOutOfStock: includeOutOfStock ? "true" : "false",
  }).toString();
  return apiFetch(`/api/pharmacy/available-medicines?${query}`);
}

export async function getItem(id) {
  return apiFetch(`/api/pharmacy/${id}`);
}
