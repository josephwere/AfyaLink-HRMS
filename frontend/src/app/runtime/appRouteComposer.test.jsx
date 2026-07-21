import { describe, it, expect, beforeAll } from "vitest";
import { initializeFrontendRuntime } from "../../services/shared/frontendRuntime";
import { createRuntimeRouteElements } from "./appRouteComposer";
import GovernmentClaimsDashboard from "../../pages/SystemAdmin/GovernmentClaimsDashboard";
import FraudGuard from "../../pages/SystemAdmin/FraudGuard";
import RegulatoryReports from "../../pages/SystemAdmin/RegulatoryReports";
import CountyCommandCenter from "../../pages/SystemAdmin/CountyCommandCenter";
import HospitalVerificationReview from "../../pages/SystemAdmin/HospitalVerificationReview";
import PatientIdentityRegistryPage from "../../pages/SystemAdmin/PatientIdentityRegistry";

describe("appRouteComposer", () => {
  beforeAll(async () => {
    await initializeFrontendRuntime({ userPermissions: [] });
  });

  it("creates runtime-backed route elements for registered domain routes", () => {
    const routes = createRuntimeRouteElements();

    expect(routes.length).toBeGreaterThan(0);

    const paths = routes.map((route) => route.props.path);
    expect(paths).toContain("/app/care/encounters/opd");
    expect(paths).toContain("/app/operations/pharmacy/inventory");
    expect(paths).toContain("/app/revenue/billing/index");
    expect(routes.every((route) => route.props.element !== null)).toBe(true);
  });

  it("maps governance routes to concrete feature pages", () => {
    const routes = createRuntimeRouteElements();
    const routeMap = new Map(routes.map((route) => [route.props.path, route.props.element]));

    expect(routeMap.get("/app/governance/claims/index")?.type).toBe(GovernmentClaimsDashboard);
    expect(routeMap.get("/app/governance/fraud/index")?.type).toBe(FraudGuard);
    expect(routeMap.get("/app/governance/reports/regulatory")?.type).toBe(RegulatoryReports);
    expect(routeMap.get("/app/governance/command/county")?.type).toBe(CountyCommandCenter);
    expect(routeMap.get("/app/governance/verification/hospitals")?.type).toBe(HospitalVerificationReview);
    expect(routeMap.get("/app/governance/registry/patient-identity")?.type).toBe(PatientIdentityRegistryPage);
  });
});
