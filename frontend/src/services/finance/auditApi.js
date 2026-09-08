import { apiFetch } from "../../utils/apiFetch";

export async function listAuditEntries({ entityType, entityId, limit = 50 } = {}) {
  const query = new URLSearchParams();
  if (entityType) query.set("entityType", String(entityType));
  if (entityId) query.set("entityId", String(entityId));
  if (limit) query.set("limit", String(limit));
  return apiFetch(`/api/finance/audit${query.toString() ? `?${query.toString()}` : ""}`);
}
