import React from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientAdsFeed } from "./usePatientAdsFeed";
import * as recruitmentAdsApi from "../services/recruitmentAdsApi";

vi.mock("../services/recruitmentAdsApi", () => ({
  listRecruitmentAds: vi.fn(),
  listRecruitmentApplications: vi.fn(),
  applyToRecruitmentAd: vi.fn(),
  trackRecruitmentAdEvent: vi.fn(),
}));

vi.mock("../utils/patientLanguage.jsx", () => ({
  usePatientLanguage: () => ({ t: (key, fallback) => fallback || key }),
}));

describe("usePatientAdsFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recruitmentAdsApi.listRecruitmentAds.mockResolvedValue({ items: [{ _id: "ad-1", title: "Nurse" }] });
    recruitmentAdsApi.listRecruitmentApplications.mockResolvedValue({ items: [] });
    recruitmentAdsApi.applyToRecruitmentAd.mockResolvedValue({ ok: true });
    recruitmentAdsApi.trackRecruitmentAdEvent.mockResolvedValue({ ok: true });
  });

  it("loads ads and submits a new application through the shared hook", async () => {
    const { result } = renderHook(() => usePatientAdsFeed({ variant: "app", defaultSource: "PATIENT_FEED", locationSearch: "" }), {
      wrapper: ({ children }) => React.createElement(MemoryRouter, null, children),
    });

    await act(async () => {
      await result.current.loadAds();
      result.current.startApply("ad-1");
      await result.current.submitApplication("ad-1");
    });

    expect(recruitmentAdsApi.listRecruitmentAds).toHaveBeenCalled();
    expect(recruitmentAdsApi.applyToRecruitmentAd).toHaveBeenCalled();
    expect(result.current.ads).toHaveLength(1);
    expect(result.current.msg).toContain("Application submitted");
  });
});
