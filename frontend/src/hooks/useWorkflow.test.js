import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkflow } from "./useWorkflow";

/**
 * useWorkflow Hook Tests
 * Validates hook loads workflow instances and manages state correctly.
 */

describe("useWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads workflow instances and updates state", async () => {
    vi.mock("../services/workflow/queries", () => ({
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: [{ _id: "1", name: "Admission" }],
        total: 1,
      }),
    }));

    const { result } = renderHook(() => useWorkflow());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      workflows: [{ _id: "1", name: "Admission" }],
      total: 1,
    });
  });

  it("refreshes on parameter change", async () => {
    vi.mock("../services/workflow/queries", () => ({
      listWorkflows: vi
        .fn()
        .mockResolvedValueOnce({
          workflows: [{ _id: "1", name: "Admission" }],
          total: 1,
        })
        .mockResolvedValueOnce({
          workflows: [{ _id: "2", name: "Discharge" }],
          total: 1,
        }),
    }));

    const { result, rerender } = renderHook(
      ({ q, page }) => useWorkflow({ q, page }),
      { initialProps: { q: "", page: 1 } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      workflows: [{ _id: "1", name: "Admission" }],
      total: 1,
    });

    // Change page parameter
    rerender({ q: "", page: 2 });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        workflows: [{ _id: "2", name: "Discharge" }],
        total: 1,
      });
    });
  });
});
