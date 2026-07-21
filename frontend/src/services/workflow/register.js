import { registerDomain } from "../shared/domainRegistry.js";
import workflowModule from "./module.js";

/**
 * Workflow Domain Registration
 * Auto-registers the workflow domain with the global registry.
 */
registerDomain(workflowModule);
