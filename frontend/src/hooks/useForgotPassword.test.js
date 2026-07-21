import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useForgotPassword } from "./useForgotPassword";
import * as authApi from "../services/authApi";

vi.mock("../services/authApi", () => ({
  requestPasswordReset: vi.fn(),
  requestPhoneResetCode: vi.fn(),
  submitPhoneReset: vi.fn(),
}));

vi.mock("../utils/systemSettings.jsx", () => ({
  useSystemSettings: () => ({ settings: {} }),
}));

vi.mock("../services/guardedAuthFetch", () => ({
  normalizeAuthUiError: (err) => err?.message || "error",
  warmAuthRuntime: vi.fn().mockResolvedValue(undefined),
}));

describe("useForgotPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits email reset requests through the service layer", async () => {
    authApi.requestPasswordReset.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useForgotPassword());

    await act(async () => {
      result.current.setEmail("demo@example.com");
    });

    await waitFor(() => {
      expect(result.current.email).toBe("demo@example.com");
    });

    await act(async () => {
      await result.current.submitEmail({ preventDefault: vi.fn() });
    });

    expect(authApi.requestPasswordReset).toHaveBeenCalledWith({ email: "demo@example.com" });
  });
});
