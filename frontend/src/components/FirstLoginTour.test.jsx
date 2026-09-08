import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import FirstLoginTour from "./FirstLoginTour";

const setUiPreferencesMock = vi.fn();
const navigateMock = vi.fn();
const uiPreferencesState = {
  current: {
    onboarding: {
      completedAt: "2025-01-01T00:00:00.000Z",
    },
  },
};

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      role: "PATIENT",
      actualRole: "PATIENT",
    },
  }),
}));

vi.mock("../utils/appLanguage.jsx", () => ({
  useAppLanguage: () => ({
    translateText: (value) => value,
  }),
}));

vi.mock("../utils/uiPreferences", () => ({
  useUiPreferences: () => ({
    uiPreferences: uiPreferencesState.current,
    setUiPreferences: setUiPreferencesMock,
  }),
}));

describe("FirstLoginTour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true,
    });
    uiPreferencesState.current = {
      onboarding: {
        completedAt: "2025-01-01T00:00:00.000Z",
      },
    };
  });

  it("does not open when onboarding has already been completed for the current user", () => {
    render(<FirstLoginTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks onboarding as completed when the tour is closed", () => {
    uiPreferencesState.current = {
      onboarding: {},
    };

    render(<FirstLoginTour />);
    fireEvent.click(screen.getByRole("button", { name: "Skip Tour" }));

    expect(setUiPreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding: expect.objectContaining({
          completedAt: expect.any(String),
          hasCompletedTour: true,
          toursSeen: expect.any(Object),
        }),
      }),
      { immediate: true }
    );
  });
});
