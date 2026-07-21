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

  it("respects context overrides for redirects", () => {
    const doctor = { role: "DOCTOR" };
    expect(redirectByRole(doctor, "WORK")).toBe("/app/care/home/index");
    expect(redirectByRole(doctor, "MY_HEALTH")).toBe("/app/portal/appointments/index");

    const patient = { role: "PATIENT" };
    expect(redirectByRole(patient, "MY_HEALTH")).toBe("/app/portal/home/index");
  });

  it("never routes service/bot/system accounts to MY_HEALTH context", () => {
    const service = { role: "DOCTOR", isServiceAccount: true };
    expect(redirectByRole(service, "MY_HEALTH")).toBe("/app/care/home/index");

    const sys = { role: "SUPER_ADMIN", accountType: "system" };
    expect(redirectByRole(sys, "MY_HEALTH")).toBe("/app/platform/home/index");
  });
});
