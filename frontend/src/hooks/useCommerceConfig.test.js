import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { useCommerceConfig } from "./useCommerceConfig";
import { getHospitalAdminConfig, saveHospitalCommerceConfig } from "../services/hospitalAdminConfigApi";

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../services/hospitalAdminConfigApi", () => ({
  getHospitalAdminConfig: vi.fn(),
  saveHospitalCommerceConfig: vi.fn(),
}));

vi.mock("../components/ActionSuccessGuide", () => ({
  showActionSuccessGuide: vi.fn(),
}));

describe("useCommerceConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads billing config and saves updates", async () => {
    getHospitalAdminConfig.mockResolvedValue({ insuranceProviders: [{ code: "SHA", name: "SHA", country: "KE" }], patientPaymentMethods: [{ label: "M-Pesa" }] });

    const { result, waitForNextUpdate } = renderHook(() => useCommerceConfig());
    await waitForNextUpdate();

    expect(result.current.insuranceProviders).toHaveLength(1);
    expect(result.current.paymentMethods).toHaveLength(1);

    saveHospitalCommerceConfig.mockResolvedValue({ ok: true });
    await act(async () => {
      await result.current.save();
    });

    expect(saveHospitalCommerceConfig).toHaveBeenCalled();
    expect(result.current.settingsSaved).toBe(true);
  });
});
