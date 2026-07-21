import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRegister } from "./useRegister";
import * as authService from "../services/guardedAuthFetch";

vi.mock("../services/guardedAuthFetch", () => ({
  guardedAuthFetch: vi.fn(),
  normalizeAuthUiError: (err) => err?.message || "error",
  warmAuthRuntime: vi.fn().mockResolvedValue(true),
}));
vi.mock("../utils/auth", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));
vi.mock("../auth/useGoogleAuth.jsx", () => ({
  useGoogleAuth: () => ({ GoogleButton: () => null, error: "" }),
}));
vi.mock("../utils/systemSettings.jsx", () => ({
  useSystemSettings: () => ({ settings: {} }),
}));
vi.mock("../utils/offlineRegistration", () => ({
  enqueueOfflineRegistration: vi.fn(),
  flushOfflineRegistrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("useRegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService.guardedAuthFetch.mockResolvedValueOnce({ accessToken: "t", user: { role: "PATIENT" } });
  });

  it("creates a registration payload and submits", async () => {
    const { result } = renderHook(() => useRegister());

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(authService.guardedAuthFetch).toHaveBeenCalled();
  });
});
