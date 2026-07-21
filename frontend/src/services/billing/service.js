import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

const billingService = createDomainRuntime(manifest);

export default billingService;
