import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

/**
 * Workflow Domain Service
 * Orchestration service for coordinating actions across multiple domains.
 */
const workflowService = createDomainRuntime(manifest);

export default workflowService;
