import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSystemAdminIntegrationControlPlane } from "./useSystemAdminIntegrationControlPlane";
import * as profileApi from "../services/profileApi";
import * as systemAdminApi from "../services/systemAdminApi";
import * as systemSettingsApi from "../services/systemSettingsApi";

vi.mock("../services/profileApi", () => ({
  getCurrentProfile: vi.fn(),
  updateCurrentProfilePreferences: vi.fn(),
}));

vi.mock("../services/systemAdminApi", () => ({
  getIntegrationControlPlane: vi.fn(),
}));

vi.mock("../services/systemSettingsApi", () => ({
  getSystemSettings: vi.fn(),
  updateSystemSettings: vi.fn(),
}));

describe("useSystemAdminIntegrationControlPlane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileApi.getCurrentProfile.mockResolvedValue({ uiPreferences: { showSecretsOnHover: true } });
    systemAdminApi.getIntegrationControlPlane.mockResolvedValue({ payload: { summary: { paymentEnabledHospitals: 2 } } });
    systemSettingsApi.getSystemSettings.mockResolvedValue({ governmentApis: {} });
    profileApi.updateCurrentProfilePreferences.mockResolvedValue({ ok: true });
  });

  it("loads the control plane payload and saves preference updates", async () => {
    const { result } = renderHook(() => useSystemAdminIntegrationControlPlane());

    await act(async () => {
      await result.current.load({ preserveData: false });
      await result.current.saveHoverPreference(false);
    });

    expect(result.current.data).toBeDefined();
    expect(profileApi.updateCurrentProfilePreferences).toHaveBeenCalledWith({ showSecretsOnHover: false });
  });
});
