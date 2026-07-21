import apiFetch from "../utils/apiFetch";
import { listSupportTickets } from "./opsApi";
import { listTransfers } from "./transferApi";

export async function listAdminDashboardTransfers(params = {}) {
  return listTransfers(params);
}

export async function getAdminDashboardMetrics() {
  const [hospitals, users, support] = await Promise.all([
    apiFetch("/api/hospitals?limit=1"),
    apiFetch("/api/users?limit=1&includeInactive=1"),
    listSupportTickets({ limit: 1 }),
  ]);

  return {
    hospitals: Number(hospitals?.total || 0),
    staff: Number(users?.total || 0),
    supportTickets: Number(support?.total ?? support?.count ?? 0),
  };
}

export default {
  listAdminDashboardTransfers,
  getAdminDashboardMetrics,
};
