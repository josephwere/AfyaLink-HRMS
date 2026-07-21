import { describe, expect, it, beforeEach } from "vitest";
import { getStoredUserContextMode } from "./UserContextContext";
import { getContextRedirectPath } from "./contextRouteRules";

describe("UserContext mode resolution and self-redirect prevention", () => {
  const store = {};

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: (key) => store[key] || null,
          setItem: (key, val) => { store[key] = String(val); },
          removeItem: (key) => { delete store[key]; },
          clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
        },
        writable: true,
        configurable: true,
      });
    }
  });

  it("returns null when no stored context mode exists in localStorage", () => {
    expect(getStoredUserContextMode()).toBeNull();
  });

  it("normalizes stored context modes correctly", () => {
    window.localStorage.setItem("afyalink_user_context_mode", "MY_HEALTH");
    expect(getStoredUserContextMode()).toBe("MY_HEALTH");

    window.localStorage.setItem("afyalink_user_context_mode", "work");
    expect(getStoredUserContextMode()).toBe("WORK");
  });

  it("prevents self-referential redirect loops when already at portal home", () => {
    expect(getContextRedirectPath("/app/portal/home/index", "WORK")).toBeNull();
    expect(getContextRedirectPath("/app/portal/home/index", "MY_HEALTH")).toBeNull();
  });

  it("prevents self-referential redirect loops when already at operations home", () => {
    expect(getContextRedirectPath("/app/operations/home/index", "WORK")).toBeNull();
  });
});
