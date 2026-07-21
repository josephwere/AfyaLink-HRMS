import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffDashboard } from "./useStaffDashboard";
import * as dashboardApi from "../services/dashboardApi";
import * as transferApi from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getStaffDashboard: vi.fn(),
}));
vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));
vi.mock("../utils/auth", () => ({
  useAuth: () => ({ user: { role: "RECEPTIONIST" } }),
}));

describe("useStaffDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads dashboard data and transfers", async () => {
    dashboardApi.getStaffDashboard.mockResolvedValueOnce({ myPendingRequests: 2 });
    transferApi.listTransfers.mockResolvedValueOnce({ items: [{ _id: "t-1", status: "Pending" }] });

    const { result } = renderHook(() => useStaffDashboard());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data?.myPendingRequests).toBe(2);
    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.role).toBe("RECEPTIONIST");
  });
});
