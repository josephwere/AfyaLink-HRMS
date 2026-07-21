import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOfflineOps } from "./useOfflineOps";
import * as offlineOpsApi from "../services/offlineOpsApi";
import * as offlineQueue from "../utils/offlineQueue";

vi.mock("../services/offlineOpsApi", () => ({
  getOfflineOpsMetrics: vi.fn(),
  getOfflineQueueStatus: vi.fn(),
}));

vi.mock("../utils/offlineQueue", () => ({
  getOfflineMetricsSnapshot: vi.fn(() => ({ queueLength: 1 })),
  refreshOfflineMetricsSnapshot: vi.fn(() => ({ queueLength: 1 })),
}));

describe("useOfflineOps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads offline ops metrics through the service layer", async () => {
    offlineOpsApi.getOfflineOpsMetrics.mockResolvedValueOnce({ byModule: [] });
    offlineOpsApi.getOfflineQueueStatus.mockResolvedValueOnce({ counts: { integrationQueue: 2, dlq: 1 } });

    const { result } = renderHook(() => useOfflineOps({ hours: 24, q: "" }));

    await act(async () => {
      await result.current.load();
    });

    expect(offlineOpsApi.getOfflineOpsMetrics).toHaveBeenCalled();
    expect(result.current.server?.byModule).toEqual([]);
    expect(result.current.queueStatus?.counts?.dlq).toBe(1);
  });
});
