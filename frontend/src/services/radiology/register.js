import { registerDomain } from "../shared/domainRegistry.js";
import radiologyModule from "./module.js";

/**
 * Radiology Domain Registration
 * Auto-registers the radiology domain with the global registry.
 */
registerDomain(radiologyModule);
