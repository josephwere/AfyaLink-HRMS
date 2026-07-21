import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProfile } from "./useProfile";
import * as profileApi from "../services/profileApi";

vi.mock("../services/profileApi", () => ({
  getCurrentProfile: vi.fn(),
  updateCurrentProfilePreferences: vi.fn(),
  loadProfileWorkspace: vi.fn(),
  updateProfileSection: vi.fn(),
  saveFamilyPreferences: vi.fn(),
  getFamilyMonitoring: vi.fn(),
  searchFamilyProfiles: vi.fn(),
  linkFamilyMinor: vi.fn(),
  unlinkFamilyMinor: vi.fn(),
  toggleTwoFactor: vi.fn(),
  setupTotp: vi.fn(),
  verifyTotp: vi.fn(),
  disableTotp: vi.fn(),
  resendVerificationEmail: vi.fn(),
  updateProfileField: vi.fn(),
  requestPhoneOtp: vi.fn(),
  verifyPhoneOtp: vi.fn(),
  changePassword: vi.fn(),
  exportAccountData: vi.fn(),
  deleteAccount: vi.fn(),
}));

describe("useProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the profile workspace through the service layer", async () => {
    profileApi.loadProfileWorkspace.mockResolvedValueOnce({ payload: { name: "Ada" } });

    const { result } = renderHook(() => useProfile());

    let outcome;
    await act(async () => {
      outcome = await result.current.loadProfileWorkspace();
    });

    expect(profileApi.loadProfileWorkspace).toHaveBeenCalled();
    expect(outcome.payload.name).toBe("Ada");
  });
});
