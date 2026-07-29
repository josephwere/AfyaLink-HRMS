import { useCallback } from "react";
import { useResource } from "./shared/useResource.js";
import { listWorkflows } from "../services/workflow/queries.js";

const EMPTY_WORKFLOW_RESULT = { workflows: [], total: 0 };

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
export function useWorkflow({ q = "", page = 1, limit = 25, status = "", listWorkflows: queryImpl } = {}) {
  const fetcher = useCallback(
    async () => {
      const listWorkflowsFn =
        typeof queryImpl === "function"
          ? queryImpl
          : listWorkflows;
      return listWorkflowsFn({ q, page, limit, status });
    },
    [q, page, limit, status, queryImpl]
  );

  return useResource({
    fetcher,
    initialData: EMPTY_WORKFLOW_RESULT,
    cacheKey: ["workflow", q, page, limit, status].join(":"),
    watchKeys: [q, page, limit, status],
  });
}
