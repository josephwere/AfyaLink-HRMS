import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAuth } from "./auth";

describe("useAuth", () => {
  it("returns an unauthenticated fallback when used outside an AuthProvider", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.hasRole("ADMIN")).toBe(false);
  });
});
