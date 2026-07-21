import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRadiologistDashboard } from "./useRadiologistDashboard";
import * as dashboardApi from "../services/dashboardApi";
import * as transferApi from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getRadiologistDashboard: vi.fn(),
}));

vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("useRadiologistDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads dashboard data and transfer continuity items", async () => {
    dashboardApi.getRadiologistDashboard.mockResolvedValueOnce({ pendingImagingOrders: 3 });
    transferApi.listTransfers.mockResolvedValueOnce({ items: [{ _id: "t-1", status: "Pending" }] });

    const { result } = renderHook(() => useRadiologistDashboard());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data?.pendingImagingOrders).toBe(3);
    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.pendingTransfers).toBe(1);
  });
});
