import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react-hooks";
import { useNurseDashboard } from "./useNurseDashboard";
import { getNurseDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getNurseDashboard: vi.fn(),
}));

vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("useNurseDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads nurse dashboard data and summarizes transfers", async () => {
    getNurseDashboard.mockResolvedValueOnce({ patientsTotal: 8, pendingLabOrders: 2, pendingRequests: { leave: 1 }, escalationSummary: { openCount: 3 } });
    listTransfers.mockResolvedValueOnce({ items: [{ _id: "t1", status: "Pending" }, { _id: "t2", status: "Approved" }] });

    const { result, waitForNextUpdate } = renderHook(() => useNurseDashboard());
    await waitForNextUpdate();

    expect(result.current.patientsTotal).toBe(8);
    expect(result.current.pendingLabOrders).toBe(2);
    expect(result.current.pendingLeaveRequests).toBe(1);
    expect(result.current.openEscalationCount).toBe(3);
    expect(result.current.pendingTransferCount).toBe(1);
  });
});
