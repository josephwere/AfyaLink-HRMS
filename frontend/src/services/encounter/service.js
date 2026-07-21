import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

/**
 * Encounter Domain Service
 * Created from manifest, exposes all queries, commands, cache, events, and permissions.
 */
const encounterService = createDomainRuntime(manifest);

export default encounterService;
