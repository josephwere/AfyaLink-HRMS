import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

/**
 * Pharmacy Domain Service
 * Created from manifest, exposes all queries, commands, cache, events, and permissions.
 */
const pharmacyService = createDomainRuntime(manifest);

export default pharmacyService;
