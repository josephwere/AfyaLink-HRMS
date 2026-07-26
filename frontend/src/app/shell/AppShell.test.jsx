import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const navigateMock = vi.fn();
const uiPreferencesState = { current: { navigation: { dismissedReminders: ["reminder-1"] } } };
const setUiPreferencesMock = vi.fn();
const flushUiPreferencesMock = vi.fn();
const testUser = {
  id: "user-1",
  role: "HOSPITAL_ADMIN",
  uiPreferences: uiPreferencesState.current,
};

vi.mock("react-router-dom", () => ({
  Outlet: () => <div data-testid="outlet" />,
  Navigate: () => null,
  useLocation: () => ({ pathname: "/app/operations/home/index" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../../utils/auth", () => ({
  useAuth: () => ({
    user: testUser,
  }),
}));

vi.mock("../../utils/systemSettings.jsx", () => ({
  useSystemSettings: () => ({ settings: {} }),
}));

vi.mock("../../utils/accessibilityPrefs", () => ({
  applyAccessibilityPrefs: vi.fn(),
  loadAccessibilityPrefs: vi.fn(() => ({})),
}));

vi.mock("../../utils/uiPreferences", () => ({
  useUiPreferences: () => ({
    uiPreferences: uiPreferencesState.current,
    setUiPreferences: setUiPreferencesMock,
    flushUiPreferences: flushUiPreferencesMock,
  }),
}));

vi.mock("../../utils/routePrefetch", () => ({
  prefetchRoutesForRole: vi.fn(),
}));

vi.mock("../../utils/offlineQueue", () => ({
  refreshOfflineMetricsSnapshot: () => ({ queueLength: 0 }),
  startOfflineAutoSync: () => () => {},
}));

vi.mock("../../services/offlineOpsApi", () => ({
  pushOfflineClientMetrics: vi.fn(),
}));

vi.mock("../../utils/locale", () => ({
  getBrowserRegionDefaults: () => ({ locale: "en", appLanguage: "en", patientLanguage: "en", timeZone: "UTC", currency: "KES" }),
}));

vi.mock("../../components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock("../../components/Navigation/Sidebar", () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock("../../components/Navigation/Breadcrumbs", () => ({ default: () => <div data-testid="breadcrumbs" /> }));
vi.mock("../../components/Navigation/QuickActions", () => ({ default: () => <div data-testid="quick-actions" /> }));
vi.mock("../../components/FirstLoginTour", () => ({ default: () => null }));
vi.mock("../../components/MobileTabBar", () => ({ default: () => null }));
vi.mock("./ContextRail", () => ({ default: () => null }));

vi.mock("../../utils/dashboardShellUtils", () => ({
  isDashboardRoute: () => false,
}));

vi.mock("../../contexts/UserContextContext", () => ({
  useUserContext: () => ({ mode: "WORK" }),
}));

vi.mock("../../contexts/contextRouteRules", () => ({
  getContextRedirectPath: () => null,
}));

vi.mock("../../utils/apiFetch", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({})),
}));

import AppShell from "./AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testUser.uiPreferences = uiPreferencesState.current;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    uiPreferencesState.current = { navigation: { dismissedReminders: ["reminder-1"] } };
    testUser.uiPreferences = uiPreferencesState.current;
  });

  it("does not loop when dismissed reminder preferences are re-supplied as fresh arrays", async () => {
    const consoleErrors = [];
    const originalConsoleError = console.error;
    console.error = (...args) => {
      consoleErrors.push(args.join(" "));
      originalConsoleError(...args);
    };

    try {
      const { rerender } = render(<AppShell />);

      uiPreferencesState.current = { navigation: { dismissedReminders: ["reminder-1"] } };
      testUser.uiPreferences = uiPreferencesState.current;
      rerender(<AppShell />);

      uiPreferencesState.current = { navigation: { dismissedReminders: ["reminder-1"] } };
      testUser.uiPreferences = uiPreferencesState.current;
      rerender(<AppShell />);

      await Promise.resolve();
      expect(consoleErrors.filter((message) => message.includes("Maximum update depth exceeded"))).toHaveLength(0);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
