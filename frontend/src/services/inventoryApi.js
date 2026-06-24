import { apiFetch } from "../utils/apiFetch";

export async function listInventory({ q, page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({ q, page, limit }).toString();
  return apiFetch(`/api/inventory/list?${query}`);
}

export async function listAvailableMedicines({ q = "", limit = 200, includeOutOfStock = true } = {}) {
  const query = new URLSearchParams({
    q,
    limit,
    includeOutOfStock: includeOutOfStock ? "true" : "false",
  }).toString();
  return apiFetch(`/api/pharmacy/available-medicines?${query}`);
}

export default { listInventory, listAvailableMedicines };
