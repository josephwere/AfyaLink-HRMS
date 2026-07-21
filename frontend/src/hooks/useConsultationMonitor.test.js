import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { useConsultationMonitor } from "./useConsultationMonitor";
import { getHospitalAdminDashboard } from "../services/dashboardApi";
import { listAppointmentCalls, updateAppointmentCall } from "../services/appointmentWorkflow";

vi.mock("../services/dashboardApi", () => ({
  getHospitalAdminDashboard: vi.fn(),
}));

vi.mock("../services/appointmentWorkflow", () => ({
  listAppointmentCalls: vi.fn(),
  updateAppointmentCall: vi.fn(),
}));

describe("useConsultationMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads consultation calls and escalations and computes summary counts", async () => {
    getHospitalAdminDashboard.mockResolvedValue({ escalationSummary: { items: [{ resolvedAt: null }, { resolvedAt: "x" }] } });
    listAppointmentCalls.mockResolvedValue({ items: [{ _id: "1", status: "REQUESTED" }, { _id: "2", status: "ACTIVE" }, { _id: "3", status: "TERMINATED", isBlocked: false }] });

    const { result, waitForNextUpdate } = renderHook(() => useConsultationMonitor());
    await waitForNextUpdate();

    expect(result.current.summary).toEqual({ requested: 1, active: 1, ended: 0, blocked: 1, wardEscalations: 1 });
    expect(result.current.visibleCalls).toHaveLength(3);
  });

  it("blocks a call through the shared service", async () => {
    getHospitalAdminDashboard.mockResolvedValue({ escalationSummary: { items: [] } });
    listAppointmentCalls.mockResolvedValue({ items: [{ _id: "1", status: "ACTIVE" }] });
    updateAppointmentCall.mockResolvedValue({ ok: true });

    const { result, waitForNextUpdate } = renderHook(() => useConsultationMonitor());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.blockCall("1");
    });

    expect(updateAppointmentCall).toHaveBeenCalledWith("1", "block");
  });
});
