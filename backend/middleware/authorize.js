// backend/middleware/authorize.js

import { policyGuard } from "./policyGuard.js";

export const authorize = (resource, action) => {
  return policyGuard(resource, action);
};
