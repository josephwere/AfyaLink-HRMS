import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

/**
 * Laboratory Domain Service
 * Created from manifest, exposes all queries, commands, cache, events, and permissions.
 */
const laboratoryService = createDomainRuntime(manifest);

export default laboratoryService;
