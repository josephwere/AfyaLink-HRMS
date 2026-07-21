import { describe, expect, it } from "vitest";

import { normalizeRole } from "./normalizeRole";
import { redirectByRole } from "./redirectByRole";
import { ROLE_VIEW_OPTIONS } from "./roleViewOptions";

describe("redirectByRole", () => {
  it("routes security admins to the security admin workspace", () => {
    expect(redirectByRole({ role: "SECURITY_ADMIN" })).toBe("/app/platform/security/admin/home");
  });

  it("routes security officers to the security officer workspace", () => {
    expect(redirectByRole({ role: "SECURITY_OFFICER" })).toBe("/app/platform/security/officer/home");
  });

  it("routes driver roles to the logistics workspace", () => {
    expect(redirectByRole({ role: "DRIVER" })).toBe("/app/operations/driver/home");
    expect(redirectByRole({ role: "AMBULANCE_DRIVER" })).toBe("/app/operations/driver/home");
  });

  it("routes mortuary roles to the mortuary workspace", () => {
    expect(redirectByRole({ role: "MORTUARY_STAFF" })).toBe("/app/operations/mortuary/home");
    expect(redirectByRole({ role: "MORTUARY_MANAGER" })).toBe("/app/operations/mortuary/home");
  });

  it("normalizes and routes auxiliary operations roles", () => {
    expect(normalizeRole("ambulance-driver")).toBe("AMBULANCE_DRIVER");
    expect(normalizeRole("mortuary-staff")).toBe("MORTUARY_STAFF");
    expect(normalizeRole("biomedical-technician")).toBe("BIOMEDICAL_TECHNICIAN");
    expect(redirectByRole({ role: "BIOMEDICAL_TECHNICIAN" })).toBe("/app/operations/home/index");
    expect(redirectByRole({ role: "MAINTENANCE_TECH" })).toBe("/app/operations/home/index");
  });

  it("exposes auxiliary operations roles in the role-view options", () => {
    expect(ROLE_VIEW_OPTIONS).toEqual(
      expect.arrayContaining([
        "DRIVER",
        "AMBULANCE_DRIVER",
        "MORTUARY_STAFF",
        "MORTUARY_MANAGER",
        "MAINTENANCE_TECH",
        "BIOMEDICAL_TECHNICIAN",
        "HOUSEKEEPING_STAFF",
        "KITCHEN_STAFF",
      ])
    );
  });
});
