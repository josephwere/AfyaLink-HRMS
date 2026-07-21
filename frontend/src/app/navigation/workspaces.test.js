import { beforeEach, describe, expect, it } from "vitest";
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

describe("workspace navigation context switching", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches to the My Health workspace when My Health mode is active", () => {
    setStoredMode("MY_HEALTH");

    const workspaces = workspacesForUser({ role: "DOCTOR" });

    expect(workspaces.map((workspace) => workspace.id)).toEqual(["portal"]);
  });

  it("returns My Health navigation items in My Health mode", () => {
    setStoredMode("MY_HEALTH");

    const nav = navForWorkspace("portal", { permissions: [] });

    expect(nav[0].items.some((item) => item.id === "portal-appointments")).toBe(true);
    expect(nav[0].items.some((item) => item.id === "care-home")).toBe(false);
  });
});
