import { describe, expect, it } from "vitest";
import { getContextRedirectPath, resolveRequiredContext } from "./contextRouteRules";

describe("context route rules", () => {
  it("classifies work routes as work-only", () => {
    expect(resolveRequiredContext("/app/care/patients/index")).toBe("WORK");
    expect(resolveRequiredContext("/app/operations/home/index")).toBe("WORK");
  });

  it("classifies portal routes as my health routes", () => {
    expect(resolveRequiredContext("/app/portal/appointments/index")).toBe("MY_HEALTH");
    expect(resolveRequiredContext("/app/portal/records/index")).toBe("MY_HEALTH");
  });

  it("lets work routes switch stale My Health context instead of redirecting", () => {
    expect(getContextRedirectPath("/app/care/patients/index", "MY_HEALTH")).toBeNull();
  });

  it("allows eligible non-patient users to access portal appointments from Work context", () => {
    expect(getContextRedirectPath("/app/portal/appointments/index", "WORK", { role: "DOCTOR" })).toBeNull();
  });

  it("lets patient portal routes switch stale Work context instead of redirecting", () => {
    expect(getContextRedirectPath("/app/portal/appointments/index", "WORK", { role: "PATIENT" })).toBeNull();
  });
});
