import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSecurityAdminDashboard } from "./useSecurityAdminDashboard";
import * as dashboardApi from "../services/dashboardApi";
import * as securityApi from "../services/securityAccessApi";
import * as transferApi from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getSecurityAdminDashboard: vi.fn(),
}));
vi.mock("../services/securityAccessApi", () => ({
  bookInternalAccess: vi.fn(),
  getAccessLogs: vi.fn(),
  getOverstays: vi.fn(),
  getSecurityAlerts: vi.fn(),
  searchUsersForAccess: vi.fn(),
}));
vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("useSecurityAdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardApi.getSecurityAdminDashboard.mockResolvedValueOnce({ officersActive: 3 });
    securityApi.getSecurityAlerts.mockResolvedValueOnce({ alerts: [{ _id: "a-1", action: "open" }] });
    securityApi.getOverstays.mockResolvedValueOnce({ overstayed: [] });
    securityApi.getAccessLogs.mockResolvedValueOnce({ items: [{ _id: "l-1", code: "ABC" }] });
    transferApi.listTransfers.mockResolvedValueOnce({ items: [{ _id: "t-1", status: "Pending" }] });
  });

  it("loads dashboard sections and pending transfer count", async () => {
    const { result } = renderHook(() => useSecurityAdminDashboard());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data?.officersActive).toBe(3);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.pendingTransfers).toBe(1);
  });
});
