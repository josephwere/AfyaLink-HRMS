import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLaboratory } from "./useLaboratory";
import * as laboratoryQueries from "../services/laboratory/queries";

vi.mock("../services/laboratory/queries", () => ({
  listTests: vi.fn(),
}));

/**
 * useLaboratory Hook Tests
 * Validates hook loads laboratory tests and manages state correctly.
 */

describe("useLaboratory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads laboratory list and updates state", async () => {
    laboratoryQueries.listTests.mockResolvedValueOnce({
      tests: [{ _id: "1", name: "Test 1" }],
      total: 1,
    });

    const { result } = renderHook(() => useLaboratory());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      tests: [{ _id: "1", name: "Test 1" }],
      total: 1,
    });
  });

  it("refreshes on parameter change", async () => {
    laboratoryQueries.listTests
      .mockResolvedValueOnce({
        tests: [{ _id: "1", name: "Test 1" }],
        total: 1,
      })
      .mockResolvedValueOnce({
        tests: [{ _id: "2", name: "Test 2" }],
        total: 1,
      });

    const { result, rerender } = renderHook(
      ({ q, page }) => useLaboratory({ q, page }),
      { initialProps: { q: "", page: 1 } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      tests: [{ _id: "1", name: "Test 1" }],
      total: 1,
    });

    // Change page parameter
    rerender({ q: "", page: 2 });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        tests: [{ _id: "2", name: "Test 2" }],
        total: 1,
      });
    });
  });
});
