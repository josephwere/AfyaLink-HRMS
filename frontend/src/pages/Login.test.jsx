import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Login from "./Login";

vi.mock("../components/PasswordInput", () => ({
  default: () => <div data-testid="password-input" />,
}));

vi.mock("../components/LegalLinks", () => ({
  default: () => <div data-testid="legal-links" />,
}));

vi.mock("../hooks/useLogin", () => ({
  useLogin: () => ({
    settings: { branding: {} },
    identifier: "",
    setIdentifier: vi.fn(),
    password: "",
    setPassword: vi.fn(),
    rememberMe: false,
    setRememberMe: vi.fn(),
    error: "",
    info: "",
    submitting: false,
    slowAuth: false,
    isOffline: false,
    GoogleButton: () => <div data-testid="google-button" />,
    googleError: "",
    clearError: vi.fn(),
    fieldErrors: {},
    handleFieldChange: vi.fn(),
    handleSubmit: vi.fn(),
  }),
}));

describe("Login", () => {
  it("renders the auth shell with a mobile-safe wrapper class", () => {
    const { container } = render(<Login />);
    const shell = container.querySelector(".auth-page-shell");

    expect(shell).not.toBeNull();
    expect(shell?.classList.contains("auth-bg")).toBe(true);
    expect(container.querySelector(".auth-card")).not.toBeNull();
  });
});
