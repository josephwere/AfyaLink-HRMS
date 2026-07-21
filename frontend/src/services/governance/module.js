import manifest from "./manifest.js";
import service from "./service.js";
import { governancePermissions } from "./permissions.js";
import { governanceRuntime } from "./runtime.js";

export const governanceModule = {
  manifest,
  service,
  runtime: governanceRuntime,
  permissions: governancePermissions,
  register: () => ({
    name: "governance",
    service,
    permissions: Object.values(governancePermissions).flat(),
    icon: "shield",
    workspace: "governance",
  }),
};

export default governanceModule;
