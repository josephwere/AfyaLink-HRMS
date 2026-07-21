import { describe, expect, it } from "vitest";
import { getPatientAppointmentFeatureFlags, isPatientExperienceMode } from "./appointmentFeatureFlags";

describe("getPatientAppointmentFeatureFlags", () => {
  it("defaults all appointment experience flags to enabled", () => {
    expect(getPatientAppointmentFeatureFlags({})).toEqual({
      discovery: true,
      map: true,
      hospitalDrawer: true,
      doctorMarketplace: true,
      aiRecommendations: true,
    });
  });

  it("honors explicit false values from the environment", () => {
    const flags = getPatientAppointmentFeatureFlags({
      VITE_PATIENT_MAP_ENABLED: "false",
      VITE_PATIENT_DOCTOR_MARKETPLACE_ENABLED: "0",
      VITE_PATIENT_AI_RECOMMENDATIONS_ENABLED: "off",
    });

    expect(flags.map).toBe(false);
    expect(flags.doctorMarketplace).toBe(false);
    expect(flags.aiRecommendations).toBe(false);
  });

  it("treats patient roles as patient mode by default", () => {
    expect(isPatientExperienceMode({ role: "PATIENT" })).toBe(true);
    expect(isPatientExperienceMode({ role: "GUEST" })).toBe(true);
  });

  it("keeps staff roles in work mode unless they explicitly switch to my health", () => {
    expect(isPatientExperienceMode({ role: "DOCTOR" })).toBe(false);
    expect(isPatientExperienceMode({ role: "DOCTOR" }, "patient")).toBe(true);
  });
});
