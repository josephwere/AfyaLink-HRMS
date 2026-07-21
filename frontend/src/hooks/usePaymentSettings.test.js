import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentSettings } from "./usePaymentSettings";
import * as paymentSettingsApi from "../services/paymentSettingsApi";

vi.mock("../services/paymentSettingsApi", () => ({
  getPaymentSettings: vi.fn(),
  savePaymentSettings: vi.fn(),
  requestPaymentSettingsOtp: vi.fn(),
  verifyPaymentSettingsOtp: vi.fn(),
  rotatePaymentSettingsPassword: vi.fn(),
}));

describe("usePaymentSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads payment settings into state", async () => {
    paymentSettingsApi.getPaymentSettings.mockResolvedValueOnce({ mode: "live" });

    const { result } = renderHook(() => usePaymentSettings());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.meta.mode).toBe("live");
    expect(result.current.form.mode).toBe("live");
  });
});
