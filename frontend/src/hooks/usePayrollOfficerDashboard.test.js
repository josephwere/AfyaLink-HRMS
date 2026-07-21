import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePayrollOfficerDashboard } from "./usePayrollOfficerDashboard";
import * as dashboardApi from "../services/dashboardApi";
import * as transferApi from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getPayrollDashboard: vi.fn(),
}));

vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("usePayrollOfficerDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads payroll dashboard data and transfers", async () => {
    dashboardApi.getPayrollDashboard.mockResolvedValueOnce({ pendingApprovals: 2 });
    transferApi.listTransfers.mockResolvedValueOnce({ items: [{ _id: "t-1", status: "Pending" }] });

    const { result } = renderHook(() => usePayrollOfficerDashboard());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data?.pendingApprovals).toBe(2);
    expect(result.current.transfers).toHaveLength(1);
  });
});
