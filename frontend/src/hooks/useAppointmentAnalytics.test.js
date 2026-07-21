import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react-hooks";
import { useAppointmentAnalytics } from "./useAppointmentAnalytics";
import {
  getAppointmentOverview,
  getAppointmentHeatmap,
  getConsultationActivity,
} from "../services/analyticsApi";

vi.mock("../services/analyticsApi", () => ({
  getAppointmentOverview: vi.fn(),
  getAppointmentHeatmap: vi.fn(),
  getConsultationActivity: vi.fn(),
}));

describe("useAppointmentAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads appointment analytics from the shared services", async () => {
    getAppointmentOverview.mockResolvedValue({ totalAppointments30d: 3, pendingAssignments: 1, noShowRate: 2, topServices: [{ _id: "General", count: 2 }], consultationModes: [{ _id: "IN_PERSON", count: 2 }] });
    getAppointmentHeatmap.mockResolvedValue([{ _id: { dayOfWeek: 1, hour: 8 }, count: 5 }]);
    getConsultationActivity.mockResolvedValue([{ _id: { callType: "VIDEO", status: "ACTIVE" }, count: 3 }]);

    const { result, waitForNextUpdate } = renderHook(() => useAppointmentAnalytics());
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.overview?.totalAppointments30d).toBe(3);
    expect(result.current.heatmap).toHaveLength(1);
    expect(result.current.consultations).toHaveLength(1);
  });
});
