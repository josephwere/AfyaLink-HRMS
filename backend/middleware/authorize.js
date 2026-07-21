// backend/middleware/authorize.js

import { policyGuard } from "./policyGuard.js";
import { authorize as authorizePolicyEngine } from "./authorizationEngine.js";

export const authorize = (resourceOrOptions, action) => {
  if (resourceOrOptions && typeof resourceOrOptions === "object" && !Array.isArray(resourceOrOptions)) {
    return authorizePolicyEngine(resourceOrOptions);
  }

  return policyGuard(resourceOrOptions, action);
};
