import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useComplianceCenter } from "./useComplianceCenter";
import { createComplianceLegalHold, getComplianceCenter, releaseComplianceLegalHold } from "../services/complianceApi";

vi.mock("../services/complianceApi", () => ({
  createComplianceLegalHold: vi.fn(),
  getComplianceCenter: vi.fn(),
  releaseComplianceLegalHold: vi.fn(),
}));

describe("useComplianceCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the compliance payload and exposes summary data", async () => {
    getComplianceCenter.mockResolvedValueOnce({
      payload: {
        auditSummary: { events7d: 3 },
        settings: { auditRetentionDays: 180 },
        activeHolds: [{ _id: "hold-1", title: "Example" }],
        recentHolds: [],
        evidencePacks: [],
      },
      clientMeta: { loadedAt: "2024-01-01T00:00:00.000Z", attempts: 1 },
    });

    const { result } = renderHook(() => useComplianceCenter());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.hasData).toBe(true);
    expect(result.current.summary.events7d).toBe(3);
    expect(result.current.activeHolds).toHaveLength(1);
  });
});
