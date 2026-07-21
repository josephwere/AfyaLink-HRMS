import { registerDomain } from "../shared/domainRegistry.js";
import laboratoryModule from "./module.js";

/**
 * Laboratory Domain Registration
 * Auto-registers the laboratory domain with the global registry.
 */
registerDomain(laboratoryModule);
