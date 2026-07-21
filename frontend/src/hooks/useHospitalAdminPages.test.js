import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHospitalAdminApprovals } from "./useHospitalAdminApprovals";
import { useHospitalAdminPharmacyReferrals } from "./useHospitalAdminPharmacyReferrals";
import { useHospitalAdminRecruitmentAds } from "./useHospitalAdminRecruitmentAds";
import * as workforceApi from "../services/workforceApi";
import * as pharmacyNetworkApi from "../services/pharmacyNetworkApi";
import * as recruitmentAdsApi from "../services/recruitmentAdsApi";

vi.mock("../services/workforceApi", () => ({
  listPendingQueue: vi.fn(),
  getWorkforceQueueInsights: vi.fn(),
  getWorkforceSlaPolicies: vi.fn(),
  getWorkforceAutomationPolicies: vi.fn(),
  getWorkforceAutomationPresets: vi.fn(),
  getWorkforceAutomationPresetHistory: vi.fn(),
  approveLeave: vi.fn(),
  rejectLeave: vi.fn(),
  approveOvertime: vi.fn(),
  rejectOvertime: vi.fn(),
  approveShift: vi.fn(),
  rejectShift: vi.fn(),
}));

vi.mock("../services/pharmacyNetworkApi", () => ({
  listRegisteredPharmacies: vi.fn(),
  listPharmacyReferrals: vi.fn(),
  createPharmacyReferral: vi.fn(),
}));

vi.mock("../services/recruitmentAdsApi", () => ({
  listRecruitmentAds: vi.fn(),
  listRecruitmentApplications: vi.fn(),
  createRecruitmentAd: vi.fn(),
  updateRecruitmentAd: vi.fn(),
  updateRecruitmentApplicationStatus: vi.fn(),
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({ user: { _id: "u-1", role: "HOSPITAL_ADMIN" } }),
}));

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    configurable: true,
  });
});

describe("Hospital Admin page hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads approvals data through the shared hook", async () => {
    workforceApi.listPendingQueue.mockResolvedValue({ items: [{ id: "1" }] });
    workforceApi.getWorkforceQueueInsights.mockResolvedValue({ summary: { pending: 1 } });
    workforceApi.getWorkforceSlaPolicies.mockResolvedValue({ items: [] });
    workforceApi.getWorkforceAutomationPolicies.mockResolvedValue({ items: [] });
    workforceApi.getWorkforceAutomationPresets.mockResolvedValue({ items: [] });
    workforceApi.getWorkforceAutomationPresetHistory.mockResolvedValue({ items: [] });

    const { result } = renderHook(() => useHospitalAdminApprovals());
    await act(async () => {
      await result.current.loadApprovalsData({ queueKindFilter: "ALL" });
    });

    expect(workforceApi.listPendingQueue).toHaveBeenCalled();
    expect(result.current.queue?.summary?.pending).toBe(1);
  });

  it("loads pharmacy referrals through the shared hook", async () => {
    pharmacyNetworkApi.listRegisteredPharmacies.mockResolvedValue({ items: [{ _id: "p1", name: "Test Pharmacy" }] });
    pharmacyNetworkApi.listPharmacyReferrals.mockResolvedValue({ items: [{ _id: "r1" }] });

    const { result } = renderHook(() => useHospitalAdminPharmacyReferrals());
    await act(async () => {
      await result.current.loadNearbyPharmacies({ q: "", lat: "-1", lng: "36", radiusKm: 25 });
      await result.current.loadExistingReferrals();
    });

    expect(pharmacyNetworkApi.listRegisteredPharmacies).toHaveBeenCalled();
    expect(result.current.pharmacies).toHaveLength(1);
    expect(result.current.referrals).toHaveLength(1);
  });

  it("submits recruitment data through the shared hook", async () => {
    recruitmentAdsApi.listRecruitmentAds.mockResolvedValue({ items: [] });
    recruitmentAdsApi.listRecruitmentApplications.mockResolvedValue({ items: [] });
    recruitmentAdsApi.createRecruitmentAd.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useHospitalAdminRecruitmentAds());
    await act(async () => {
      await result.current.loadRecruitmentData();
      await result.current.createRecruitmentCampaign(new FormData());
    });

    expect(recruitmentAdsApi.createRecruitmentAd).toHaveBeenCalled();
    expect(result.current.msg).toContain("published");
  });
});
