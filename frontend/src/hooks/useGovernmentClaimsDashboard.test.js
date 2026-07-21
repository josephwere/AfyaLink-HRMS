import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react-hooks";
import { useGovernmentClaimsDashboard } from "./useGovernmentClaimsDashboard";
import claimsService from "../services/claims";

vi.mock("../services/claims", () => ({
  default: {
    getGovernmentOverview: vi.fn(),
    listGovernmentClaims: vi.fn(),
    listGovernmentAlerts: vi.fn(),
    listGovernmentHospitals: vi.fn(),
    listGovernmentInspections: vi.fn(),
    listGovernmentEnforcements: vi.fn(),
    listGovernmentHealthFunds: vi.fn(),
    getGovernmentAuditLogs: vi.fn(),
    getGovernmentNotifications: vi.fn(),
    getGovernmentPatientHistory: vi.fn(),
    getClaimAuditTrail: vi.fn(),
    reviewClaim: vi.fn(),
    requestVerification: vi.fn(),
    assignAudit: vi.fn(),
    createInspection: vi.fn(),
    updateInspectionStatus: vi.fn(),
    createEnforcement: vi.fn(),
    updateEnforcementStatus: vi.fn(),
    createHealthFund: vi.fn(),
    updateHealthFund: vi.fn(),
  },
}));

describe("useGovernmentClaimsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the dashboard overview and claim lists", async () => {
    claimsService.getGovernmentOverview.mockResolvedValue({ summary: { totalClaims: 2 } });
    claimsService.listGovernmentClaims.mockResolvedValue({ items: [{ _id: "1" }] });
    claimsService.listGovernmentAlerts.mockResolvedValue({ items: [] });
    claimsService.listGovernmentHospitals.mockResolvedValue({ items: [] });
    claimsService.listGovernmentInspections.mockResolvedValue({ items: [] });
    claimsService.listGovernmentEnforcements.mockResolvedValue({ items: [] });
    claimsService.listGovernmentHealthFunds.mockResolvedValue({ items: [] });
    claimsService.getGovernmentAuditLogs.mockResolvedValue({ items: [] });
    claimsService.getGovernmentNotifications.mockResolvedValue({ items: [] });

    const { result, waitForNextUpdate } = renderHook(() => useGovernmentClaimsDashboard());
    await waitForNextUpdate();

    expect(result.current.overview.summary.totalClaims).toBe(2);
    expect(result.current.claims).toHaveLength(1);
  });

  it("opens claim audit details", async () => {
    claimsService.getGovernmentOverview.mockResolvedValue({ summary: { totalClaims: 0 } });
    claimsService.listGovernmentClaims.mockResolvedValue({ items: [] });
    claimsService.listGovernmentAlerts.mockResolvedValue({ items: [] });
    claimsService.listGovernmentHospitals.mockResolvedValue({ items: [] });
    claimsService.listGovernmentInspections.mockResolvedValue({ items: [] });
    claimsService.listGovernmentEnforcements.mockResolvedValue({ items: [] });
    claimsService.listGovernmentHealthFunds.mockResolvedValue({ items: [] });
    claimsService.getGovernmentAuditLogs.mockResolvedValue({ items: [] });
    claimsService.getGovernmentNotifications.mockResolvedValue({ items: [] });
    claimsService.getClaimAuditTrail.mockResolvedValue({ items: [{ _id: "z", event: "Reviewed" }] });

    const { result, waitForNextUpdate } = renderHook(() => useGovernmentClaimsDashboard());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.openAudit("1");
    });

    expect(result.current.auditOpen).toBe(true);
    expect(result.current.auditTrail).toHaveLength(1);
  });
});
