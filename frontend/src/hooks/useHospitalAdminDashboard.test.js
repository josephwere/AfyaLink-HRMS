import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHospitalAdminDashboard } from "./useHospitalAdminDashboard";
import * as dashboardApi from "../services/dashboardApi";
import * as trainingTrackerApi from "../services/trainingTrackerApi";
import * as transferApi from "../services/transferApi";
import * as mlApi from "../services/mlApi";
import * as guardedConsoleFetchModule from "../services/guardedConsoleFetch";

vi.mock("../services/dashboardApi", () => ({
  getHospitalAdminDashboard: vi.fn(),
  getExecutiveDashboard: vi.fn(),
}));
vi.mock("../services/trainingTrackerApi", () => ({
  listTrainingTrackers: vi.fn(),
}));
vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));
vi.mock("../services/mlApi", () => ({
  runStaffingForecast: vi.fn(),
}));
vi.mock("../services/guardedConsoleFetch", () => ({
  guardedConsoleFetch: vi.fn(),
}));
vi.mock("../utils/auth", () => ({
  useAuth: () => ({ user: { hospital: "h-1" } }),
}));

describe("useHospitalAdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardApi.getHospitalAdminDashboard.mockResolvedValue({ totalStaff: 3 });
    dashboardApi.getExecutiveDashboard.mockResolvedValue({ occupiedBeds: 2, totalBeds: 5 });
    trainingTrackerApi.listTrainingTrackers.mockResolvedValue({ items: [] });
    transferApi.listTransfers.mockResolvedValue({ items: [] });
    mlApi.runStaffingForecast.mockResolvedValue({ forecast: "ok" });
    guardedConsoleFetchModule.guardedConsoleFetch.mockResolvedValue({ payload: { items: [] } });
  });

  it("loads dashboard sections without crashing", async () => {
    const { result } = renderHook(() => useHospitalAdminDashboard());
    await act(async () => {
      await result.current.loadDashboard();
    });
    expect(result.current.data?.totalStaff).toBe(3);
    expect(result.current.executiveData?.occupiedBeds).toBe(2);
  });
});
