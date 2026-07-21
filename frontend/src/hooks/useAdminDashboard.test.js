import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminDashboard } from "./useAdminDashboard";
import * as adminDashboardApi from "../services/adminDashboardApi";

vi.mock("../services/adminDashboardApi", () => ({
  getAdminDashboardMetrics: vi.fn(),
  listAdminDashboardTransfers: vi.fn(),
}));

describe("useAdminDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads transfer and metrics data through the service layer", async () => {
    adminDashboardApi.getAdminDashboardMetrics.mockResolvedValueOnce({
      hospitals: 2,
      staff: 7,
      supportTickets: 3,
    });
    adminDashboardApi.listAdminDashboardTransfers.mockResolvedValueOnce({
      items: [{ _id: "1", status: "Pending" }],
    });

    const { result } = renderHook(() => useAdminDashboard());

    await act(async () => {
      await result.current.load();
    });

    expect(adminDashboardApi.getAdminDashboardMetrics).toHaveBeenCalled();
    expect(adminDashboardApi.listAdminDashboardTransfers).toHaveBeenCalled();
    expect(result.current.metrics.hospitals).toBe(2);
    expect(result.current.pendingTransfers).toBe(1);
  });
});
