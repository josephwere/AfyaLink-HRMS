import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSystemAdminDashboard } from "./useSystemAdminDashboard";
import {
  getCountyCommandCenterSummary,
  getIntegrationControlPlane,
  getRiskPolicy,
  getSystemAdminMetrics,
  updateRiskPolicy,
} from "../services/systemAdminApi";
import { getDeveloperOverview, getTrustStatus, runWorkflowSlaScan } from "../services/developerApi";
import { listTrainingTrackers } from "../services/trainingTrackerApi";
import { listTransfers } from "../services/transferApi";
import { guardedConsoleFetch } from "../services/guardedConsoleFetch";

vi.mock("../services/systemAdminApi", () => ({
  getCountyCommandCenterSummary: vi.fn(),
  getIntegrationControlPlane: vi.fn(),
  getRiskPolicy: vi.fn(),
  getSystemAdminMetrics: vi.fn(),
  updateRiskPolicy: vi.fn(),
}));
vi.mock("../services/developerApi", () => ({
  getDeveloperOverview: vi.fn(),
  getTrustStatus: vi.fn(),
  runWorkflowSlaScan: vi.fn(),
}));
vi.mock("../services/trainingTrackerApi", () => ({ listTrainingTrackers: vi.fn() }));
vi.mock("../services/transferApi", () => ({ listTransfers: vi.fn() }));
vi.mock("../services/guardedConsoleFetch", () => ({ guardedConsoleFetch: vi.fn() }));

describe("useSystemAdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads dashboard data and computes transfer counts", async () => {
    getSystemAdminMetrics.mockResolvedValueOnce({ hospitals: 7 });
    getDeveloperOverview.mockResolvedValueOnce({ queues: { dlq: { failed: 0 } } });
    getTrustStatus.mockResolvedValueOnce({ trust: { policyDenials24h: 2 } });
    getIntegrationControlPlane.mockResolvedValueOnce({ controlPlanes: [{ readiness: "READY" }] });
    getCountyCommandCenterSummary.mockResolvedValueOnce({ summary: { regionsAtRisk: 1 } });
    getRiskPolicy.mockResolvedValueOnce({ policy: "test" });
    listTransfers.mockResolvedValueOnce({ items: [{ status: "Pending" }] });
    listTrainingTrackers.mockResolvedValueOnce({ items: [{ status: "COMPLETED" }] });
    guardedConsoleFetch.mockResolvedValueOnce({ payload: { items: [] } });

    const { result } = renderHook(() => useSystemAdminDashboard());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.metrics.hospitals).toBe(7);
    expect(result.current.pendingTransfers).toBe(1);
    expect(result.current.readyControlModules).toBe(1);
  });
});
