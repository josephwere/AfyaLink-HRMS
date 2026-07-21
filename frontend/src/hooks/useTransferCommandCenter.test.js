import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useTransferCommandCenter } from "./useTransferCommandCenter";
import * as hospitalAdminOperationsApi from "../services/hospitalAdminOperationsApi";

vi.mock("../services/hospitalAdminOperationsApi", () => ({
  listTransferCommandCenterOverview: vi.fn(),
  listTransferHospitals: vi.fn(),
  searchTransferPatients: vi.fn(),
  requestTransferCommand: vi.fn(),
  approveTransferCommand: vi.fn(),
  rejectTransferCommand: vi.fn(),
  completeTransferCommand: vi.fn(),
  grantTransferConsentCommand: vi.fn(),
  revokeTransferConsentCommand: vi.fn(),
  getTransferDetailCommand: vi.fn(),
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({ user: { role: "HOSPITAL_ADMIN" } }),
}));

vi.mock("../utils/normalizeRole", () => ({
  normalizeRole: (role) => String(role || "").toUpperCase(),
}));

describe("useTransferCommandCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hospitalAdminOperationsApi.listTransferCommandCenterOverview.mockResolvedValue({
      summary: { total: 1, pending: 1, approved: 0, consentPending: 0, overdue: 0, lowContinuity: 0 },
      items: [{ _id: "tx-1", patientName: "Jane Doe", status: "Pending", consentStatus: "Pending" }],
    });
    hospitalAdminOperationsApi.listTransferHospitals.mockResolvedValue({ items: [{ _id: "h-1", name: "Test Hospital" }] });
    hospitalAdminOperationsApi.searchTransferPatients.mockResolvedValue({ items: [{ _id: "p-1", firstName: "Jane", lastName: "Doe" }] });
    hospitalAdminOperationsApi.getTransferDetailCommand.mockResolvedValue({ handover: null, consent: null, audit: null });
  });

  it("loads overview data and exposes permissions", async () => {
    const { result } = renderHook(() => useTransferCommandCenter());

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.canRequest).toBe(true);
    expect(result.current.canApprove).toBe(true);
    expect(result.current.canConsent).toBe(true);
    expect(result.current.data?.summary?.total).toBe(1);
  });
});
