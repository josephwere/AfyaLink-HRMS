import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { useClaimsDashboard } from "./useClaimsDashboard";
import claimsService from "../services/claims";

vi.mock("../services/claims", () => ({
  default: {
    getSummary: vi.fn(),
    listClaims: vi.fn(),
    listAlerts: vi.fn(),
    getAuditTrail: vi.fn(),
    reviewClaim: vi.fn(),
  },
}));

describe("useClaimsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads claims and alerts and computes summary stats", async () => {
    claimsService.getSummary.mockResolvedValue({ totals: { totalClaims: 1, reviewClaims: 1, rejectedClaims: 0, openAlerts: 1 } });
    claimsService.listClaims.mockResolvedValue({ items: [{ _id: "1", status: "PENDING", riskScore: 80 }] });
    claimsService.listAlerts.mockResolvedValue({ items: [{ _id: "a", severity: "HIGH", status: "OPEN" }] });

    const { result, waitForNextUpdate } = renderHook(() => useClaimsDashboard());
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.claims).toHaveLength(1);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.stats).toEqual({ openAlerts: 1, claimsLoaded: 1, highRisk: 1, pending: 1 });
  });

  it("opens and closes claim audit details", async () => {
    claimsService.getSummary.mockResolvedValue({ totals: { totalClaims: 0, reviewClaims: 0, rejectedClaims: 0, openAlerts: 0 } });
    claimsService.listClaims.mockResolvedValue({ items: [] });
    claimsService.listAlerts.mockResolvedValue({ items: [] });
    claimsService.getAuditTrail.mockResolvedValue({ items: [{ _id: "z", event: "Reviewed" }] });

    const { result, waitForNextUpdate } = renderHook(() => useClaimsDashboard());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.openAudit({ _id: "1" });
    });

    expect(result.current.auditOpen).toBe(true);
    expect(result.current.auditLogs).toHaveLength(1);

    act(() => {
      result.current.closeAudit();
    });

    expect(result.current.auditOpen).toBe(false);
  });
});
