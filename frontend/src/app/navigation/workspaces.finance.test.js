import { describe, expect, it, beforeEach } from "vitest";
import { workspacesForUser, navForWorkspace } from "./workspaces";

const storage = {};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
  },
});

function setStoredMode(mode) {
  window.localStorage.setItem("afyalink_user_context_mode", mode);
}

describe("finance workspace navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows finance workspace for hospital admin", () => {
    const workspaces = workspacesForUser({ role: "HOSPITAL_ADMIN" });
    expect(workspaces.map((workspace) => workspace.id)).toContain("finance");
  });

  it("shows finance nav items for finance workspace", () => {
    const nav = navForWorkspace("finance", { permissions: [] });
    expect(nav[0].items.some((item) => item.path === "/app/finance/billing/index")).toBe(true);
    expect(nav[0].items.some((item) => item.path === "/app/finance/general-ledger/index")).toBe(true);
  });

  it("does not show finance workspace in MY_HEALTH mode", () => {
    setStoredMode("MY_HEALTH");
    const workspaces = workspacesForUser({ role: "HOSPITAL_ADMIN" });
    expect(workspaces.map((workspace) => workspace.id)).not.toContain("finance");
  });
});
