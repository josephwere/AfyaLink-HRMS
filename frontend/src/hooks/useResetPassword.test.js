import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResetPassword } from "./useResetPassword";
import * as resetPasswordApi from "../services/resetPasswordApi";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams("token=abc123")],
}));

vi.mock("../services/resetPasswordApi", () => ({
  resetPassword: vi.fn(),
}));

describe("useResetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits the reset password request through the service layer", async () => {
    resetPasswordApi.resetPassword.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useResetPassword());

    await act(async () => {
      await result.current.submit({ preventDefault: vi.fn() });
    });

    expect(resetPasswordApi.resetPassword).toHaveBeenCalledWith({ token: "abc123", password: "" });
  });
});
