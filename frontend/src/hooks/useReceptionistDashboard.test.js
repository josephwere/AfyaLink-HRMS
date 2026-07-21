import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react-hooks";
import { useReceptionistDashboard } from "./useReceptionistDashboard";
import { getReceptionistDashboard } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

vi.mock("../services/dashboardApi", () => ({
  getReceptionistDashboard: vi.fn(),
}));

vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("useReceptionistDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads receptionist dashboard data and transfer summary", async () => {
    getReceptionistDashboard.mockResolvedValueOnce({ appointmentsToday: 3, patientsTotal: 10 });
    listTransfers.mockResolvedValueOnce({ items: [{ _id: "t1", status: "Pending" }] });

    const { result, waitForNextUpdate } = renderHook(() => useReceptionistDashboard());
    await waitForNextUpdate();

    expect(result.current.data?.appointmentsToday).toBe(3);
    expect(result.current.pendingTransferCount).toBe(1);
  });
});
