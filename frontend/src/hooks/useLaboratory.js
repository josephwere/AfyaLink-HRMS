import { useCallback } from "react";
import { useResource } from "./shared/useResource.js";
import laboratoryService from "../services/laboratory/service.js";

/**
 * useLaboratory Hook
 * Provides access to laboratory domain queries and state management.
 *
 * @param {Object} options - Hook options
 * @param {string} options.q - Search query
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.limit - Items per page
 * @param {string} options.status - Filter by status (optional)
 *
 * @returns {Object} Laboratory state and refresh function
 */
export function useLaboratory({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const fetcher = useCallback(
    async () => laboratoryService.listTests({ q, page, limit, status }),
    [q, page, limit, status]
  );

  return useResource({
    fetcher,
    initialData: { tests: [], total: 0 },
    cacheKey: ["laboratory", q, page, limit, status].join(":"),
    watchKeys: [q, page, limit, status],
  });
}
