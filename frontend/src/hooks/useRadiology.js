import { useCallback } from "react";
import { useResource } from "./shared/useResource.js";
import radiologyService from "../services/radiology/service.js";

/**
 * useRadiology Hook
 * Provides access to radiology domain queries and state management.
 *
 * @param {Object} options - Hook options
 * @param {string} options.q - Search query
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.limit - Items per page
 * @param {string} options.status - Filter by status (optional)
 *
 * @returns {Object} Radiology state and refresh function
 */
export function useRadiology({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const fetcher = useCallback(
    async () => radiologyService.listStudies({ q, page, limit, status }),
    [q, page, limit, status]
  );

  return useResource({
    fetcher,
    initialData: { studies: [], total: 0 },
    cacheKey: ["radiology", q, page, limit, status].join(":"),
    watchKeys: [q, page, limit, status],
  });
}
