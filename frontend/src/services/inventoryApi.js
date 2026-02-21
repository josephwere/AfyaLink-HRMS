import { apiFetch } from "../utils/apiFetch";

export async function listInventory({ q, page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({ q, page, limit }).toString();
  return apiFetch(`/api/inventory/list?${query}`);
}

export default { listInventory };
