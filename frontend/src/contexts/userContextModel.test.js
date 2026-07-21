import { describe, expect, it } from "vitest";
import { canUseMyHealthContext, getDefaultContextMode, isPatientContextUser } from "./userContextModel";

describe("userContextModel", () => {
  it("allows human accounts to use My Health context", () => {
    expect(canUseMyHealthContext({ role: "DOCTOR" })).toBe(true);
    expect(canUseMyHealthContext({ role: "GOVERNMENT_ADMIN" })).toBe(true);
    expect(canUseMyHealthContext({ role: "AMBULANCE_DRIVER" })).toBe(true);
  });

  it("blocks non-human system accounts from My Health", () => {
    expect(canUseMyHealthContext({ accountType: "service" })).toBe(false);
    expect(canUseMyHealthContext({ isServiceAccount: true })).toBe(false);
    expect(canUseMyHealthContext({ isBotAccount: true })).toBe(false);
  });

  it("defaults patients to My Health and others to Work unless they can use the context", () => {
    expect(getDefaultContextMode({ role: "PATIENT" })).toBe("MY_HEALTH");
    expect(getDefaultContextMode({ role: "DOCTOR" })).toBe("WORK");
    expect(getDefaultContextMode({ accountType: "service" })).toBe("WORK");
  });

  it("identifies patient-facing accounts clearly", () => {
    expect(isPatientContextUser({ role: "PATIENT" })).toBe(true);
    expect(isPatientContextUser({ role: "GUEST" })).toBe(true);
    expect(isPatientContextUser({ role: "DOCTOR" })).toBe(false);
  });
});
