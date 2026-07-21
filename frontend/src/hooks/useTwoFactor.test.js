import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTwoFactor } from "./useTwoFactor";
import * as authApi from "../services/authApi";

const navigateMock = vi.fn();
const complete2FAMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: { userId: "user-1", email: "demo@example.com", method: "OTP", reason: "ACCOUNT_2FA" } }),
  Link: ({ children }) => children,
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({ complete2FA: complete2FAMock }),
}));

vi.mock("../utils/systemSettings.jsx", () => ({
  useSystemSettings: () => ({ settings: {} }),
}));

vi.mock("../services/guardedAuthFetch", () => ({
  normalizeAuthUiError: (err) => err?.message || "error",
  warmAuthRuntime: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/authApi", () => ({
  verifyTwoFactor: vi.fn(),
  resendTwoFactorCode: vi.fn(),
}));

describe("useTwoFactor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies two-factor codes through the auth service", async () => {
    authApi.verifyTwoFactor.mockResolvedValueOnce({ accessToken: "t", refreshToken: "r", user: {} });

    const { result } = renderHook(() => useTwoFactor());

    await act(async () => {
      result.current.setOtp("123456");
    });

    await waitFor(() => {
      expect(result.current.otp).toBe("123456");
    });

    await act(async () => {
      await result.current.submitOtp({ preventDefault: vi.fn() });
    });

    expect(authApi.verifyTwoFactor).toHaveBeenCalledWith({ userId: "user-1", otp: "123456" });
  });
});
