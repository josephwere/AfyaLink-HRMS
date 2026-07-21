import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogin } from "./useLogin";

const loginMock = vi.fn();
const navigateMock = vi.fn();
const redirectByRoleMock = vi.fn(() => "/app/portal/home/index");

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ search: "" }),
  Link: ({ children }) => children,
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock("../auth/useGoogleAuth.jsx", () => ({
  useGoogleAuth: () => ({ GoogleButton: () => null, error: "", clearError: vi.fn() }),
}));

vi.mock("../utils/systemSettings.jsx", () => ({
  useSystemSettings: () => ({ settings: {} }),
}));

vi.mock("../utils/redirectByRole", () => ({
  redirectByRole: (...args) => redirectByRoleMock(...args),
}));

vi.mock("../services/guardedAuthFetch", () => ({
  normalizeAuthUiError: (err) => err?.message || "error",
  warmAuthRuntime: vi.fn().mockResolvedValue(undefined),
}));

describe("useLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginMock.mockResolvedValue({
      user: { role: "PATIENT", emailVerified: true, phoneVerified: false },
      accessToken: "token",
    });
    redirectByRoleMock.mockReturnValue("/app/portal/home/index");
  });

  it("submits credentials through auth and opens the role landing page", async () => {
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      result.current.setIdentifier("demo@example.com");
      result.current.setPassword("secret");
    });

    await waitFor(() => {
      expect(result.current.identifier).toBe("demo@example.com");
      expect(result.current.password).toBe("secret");
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(loginMock).toHaveBeenCalledWith("demo@example.com", "secret");
    expect(redirectByRoleMock).toHaveBeenCalledWith({
      role: "PATIENT",
      emailVerified: true,
      phoneVerified: false,
    });
    expect(navigateMock).toHaveBeenCalledWith("/app/portal/home/index", {
      replace: true,
      state: { info: "Signed in successfully." },
    });
  });

  it("does not trap newly registered unverified users on the login page", async () => {
    loginMock.mockResolvedValueOnce({
      user: { role: "PATIENT", emailVerified: false, phoneVerified: false },
      accessToken: "token",
    });

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      result.current.setIdentifier("new.patient@example.com");
      result.current.setPassword("secret");
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(navigateMock).toHaveBeenCalledWith("/app/portal/home/index", {
      replace: true,
      state: {
        info: "Your account is signed in. Complete email or phone verification from Profile when you are ready.",
      },
    });
  });
});
