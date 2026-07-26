import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRadiology } from "./useRadiology";
import * as radiologyQueries from "../services/radiology/queries";

vi.mock("../services/radiology/queries", () => ({
  listStudies: vi.fn(),
}));

/**
 * useRadiology Hook Tests
 * Validates hook loads radiology studies and manages state correctly.
 */

describe("useRadiology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads radiology studies and updates state", async () => {
    radiologyQueries.listStudies.mockResolvedValueOnce({
      studies: [{ _id: "1", studyType: "CT" }],
      total: 1,
    });

    const { result } = renderHook(() => useRadiology());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      studies: [{ _id: "1", studyType: "CT" }],
      total: 1,
    });
  });

  it("refreshes on parameter change", async () => {
    radiologyQueries.listStudies
      .mockResolvedValueOnce({
        studies: [{ _id: "1", studyType: "CT" }],
        total: 1,
      })
      .mockResolvedValueOnce({
        studies: [{ _id: "2", studyType: "MRI" }],
        total: 1,
      });

    const { result, rerender } = renderHook(
      ({ q, page }) => useRadiology({ q, page }),
      { initialProps: { q: "", page: 1 } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      studies: [{ _id: "1", studyType: "CT" }],
      total: 1,
    });

    // Change page parameter
    rerender({ q: "", page: 2 });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        studies: [{ _id: "2", studyType: "MRI" }],
        total: 1,
      });
    });
  });
});
