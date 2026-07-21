import { useCallback } from "react";
import { useResource } from "./shared/useResource.js";
import workflowService from "../services/workflow/service.js";

/**
 * useWorkflow Hook
 * Provides access to workflow domain queries and state management.
 * Manages multi-step orchestrated workflows across clinical domains.
 *
 * @param {Object} options - Hook options
 * @param {string} options.q - Search query
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.limit - Items per page
 * @param {string} options.status - Filter by status (optional)
 *
 * @returns {Object} Workflow state and refresh function
 */
export function useWorkflow({ q = "", page = 1, limit = 25, status = "" } = {}) {
  const fetcher = useCallback(
    async () => workflowService.listWorkflows({ q, page, limit, status }),
    [q, page, limit, status]
  );

  return useResource({
    fetcher,
    initialData: { workflows: [], total: 0 },
    cacheKey: ["workflow", q, page, limit, status].join(":"),
    watchKeys: [q, page, limit, status],
  });
}
