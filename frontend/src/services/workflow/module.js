import manifest from "./manifest.js";
import service from "./service.js";
import { workflowPermissions } from "./permissions.js";
import { workflowRuntime } from "./runtime.js";
import { workflowEvents, WORKFLOW_EVENTS } from "./events.js";
import cache from "./cache.js";
import * as queries from "./queries.js";
import * as commands from "./commands.js";
import { useWorkflow } from "../../hooks/useWorkflow";

export const domainModule = {
  manifest,
  service,
  runtime: workflowRuntime,
  permissions: workflowPermissions,
  cache,
  events: workflowEvents,
  eventTypes: WORKFLOW_EVENTS,
  queries,
  commands,
  register: () => ({
    name: "workflow",
    service,
    hook: useWorkflow,
    permissions: ["admin", "doctor", "nurse", "lab-tech", "radiologist", "pathologist"],
    icon: "workflow",
    workspace: "operations",
  }),
};

export default domainModule;
