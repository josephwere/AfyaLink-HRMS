import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVerifyEmail } from "./useVerifyEmail";
import * as authApi from "../services/authApi";

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams("token=abc123")],
  Link: ({ children }) => children,
}));

vi.mock("../services/authApi", () => ({
  verifyEmailToken: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

describe("useVerifyEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies email tokens through the auth service", async () => {
    authApi.verifyEmailToken.mockResolvedValueOnce({ ok: true });

    renderHook(() => useVerifyEmail());

    await waitFor(() => {
      expect(authApi.verifyEmailToken).toHaveBeenCalledWith("abc123");
    });
  });

  it("resends verification email through the auth service", async () => {
    authApi.resendVerificationEmail.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useVerifyEmail());

    await act(async () => {
      result.current.setEmail("demo@example.com");
    });

    await waitFor(() => {
      expect(result.current.email).toBe("demo@example.com");
    });

    await act(async () => {
      await result.current.handleResend();
    });

    expect(authApi.resendVerificationEmail).toHaveBeenCalledWith("demo@example.com");
  });
});
