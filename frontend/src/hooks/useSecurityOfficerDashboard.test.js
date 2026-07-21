import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSecurityOfficerDashboard } from "./useSecurityOfficerDashboard";
import * as dashboardApi from "../services/dashboardApi";
import * as securityAccessApi from "../services/securityAccessApi";
import * as transferApi from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getSecurityOfficerDashboard: vi.fn(),
}));

vi.mock("../services/securityAccessApi", () => ({
  bookVisitorAccess: vi.fn(),
  checkInAccess: vi.fn(),
  checkOutAccess: vi.fn(),
  getAccessLogs: vi.fn(),
  getLiveOccupancy: vi.fn(),
  verifyAccessCode: vi.fn(),
}));

vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({ user: { hospital: "Main" } }),
}));

describe("useSecurityOfficerDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads dashboard panels and transfer summaries", async () => {
    dashboardApi.getSecurityOfficerDashboard.mockResolvedValueOnce({ openIncidents: 2 });
    securityAccessApi.getAccessLogs.mockResolvedValueOnce({ items: [{ _id: "l-1" }] });
    securityAccessApi.getLiveOccupancy.mockResolvedValueOnce({ peopleInside: [{ _id: "p-1" }] });
    transferApi.listTransfers.mockResolvedValueOnce({ items: [{ _id: "t-1", status: "Pending" }] });

    const { result } = renderHook(() => useSecurityOfficerDashboard());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data?.openIncidents).toBe(2);
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.inside).toHaveLength(1);
    expect(result.current.pendingTransfers).toBe(1);
  });
});
