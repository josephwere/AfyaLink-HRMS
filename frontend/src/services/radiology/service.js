import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

/**
 * Radiology Domain Service
 * Created from manifest, exposes all queries, commands, cache, events, and permissions.
 */
const radiologyService = createDomainRuntime(manifest);

export default radiologyService;
