import { registerDomain } from "../shared/domainRegistry";
import { initializeFrontendRuntime, getRuntimeRoutes, getRuntimeNavigationItems, getRuntimeDependencies } from "../shared/frontendRuntime";

const domainModules = [
  () => import("../encounter/register"),
  () => import("../pharmacy/register"),
  () => import("../laboratory/register"),
  () => import("../radiology/register"),
  () => import("../workflow/register"),
  () => import("../billing/register"),
  () => import("../governance/register"),
];

export function registerAllDomains() {
  const registered = [];
  for (const loader of domainModules) {
    const modulePromise = loader();
    registered.push(modulePromise);
  }
  return registered;
}

// Auto-register all domains at application startup
registerAllDomains();

// Re-export for easy access
export { initializeFrontendRuntime, getRuntimeRoutes, getRuntimeNavigationItems, getRuntimeDependencies } from "../shared/frontendRuntime";
export { default as encounterService } from "../encounter/service";
export { default as pharmacyService } from "../pharmacy/service";
export { default as laboratoryService } from "../laboratory/service";
export { default as radiologyService } from "../radiology/service";
export { default as workflowService } from "../workflow/service";
export { default as billingService } from "../billing/service";
export { default as governanceService } from "../governance/service";

export { useEncounter } from "../../hooks/useEncounter";
export { usePharmacy } from "../../hooks/usePharmacy";
export { useLaboratory } from "../../hooks/useLaboratory";
export { useRadiology } from "../../hooks/useRadiology";
export { useWorkflow } from "../../hooks/useWorkflow";

export { getDomain, getAllDomains } from "../shared/domainRegistry";
