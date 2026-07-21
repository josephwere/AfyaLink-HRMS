import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAbacPolicies } from "./useAbacPolicies";
import * as systemAdminApi from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  listAbacPolicies: vi.fn(),
  createAbacPolicy: vi.fn(),
  updateAbacPolicy: vi.fn(),
  deleteAbacPolicy: vi.fn(),
  simulateAbacPolicy: vi.fn(),
  listAbacTestCases: vi.fn(),
  createAbacTestCase: vi.fn(),
  deleteAbacTestCase: vi.fn(),
  runAbacTestCase: vi.fn(),
  runAllAbacTestCases: vi.fn(),
}));

describe("useAbacPolicies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads policies and test cases on mount", async () => {
    vi.mocked(systemAdminApi.listAbacPolicies).mockResolvedValue([{ _id: "p1", domain: "INTEROP", resource: "transfer_export", action: "read" }]);
    vi.mocked(systemAdminApi.listAbacTestCases).mockResolvedValue([{ _id: "t1" }]);

    const { result } = renderHook(() => useAbacPolicies());

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.testCases).toHaveLength(1);
    expect(systemAdminApi.listAbacPolicies).toHaveBeenCalled();
  });

  it("creates a policy and refreshes the page state", async () => {
    vi.mocked(systemAdminApi.listAbacPolicies).mockResolvedValue([]);
    vi.mocked(systemAdminApi.listAbacTestCases).mockResolvedValue([]);
    vi.mocked(systemAdminApi.createAbacPolicy).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAbacPolicies());

    await waitFor(() => expect(result.current.items).toEqual([]));

    await act(async () => {
      await result.current.save();
    });

    expect(systemAdminApi.createAbacPolicy).toHaveBeenCalled();
  });
});
