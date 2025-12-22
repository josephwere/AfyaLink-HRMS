import Workflow from "../models/Workflow.js";
import { WORKFLOW_SLA } from "../constants/workflowSLA.js";
import { logAudit } from "./auditService.js";

export async function checkWorkflowSLA() {
  const workflows = await Workflow.find({
    state: { $in: Object.keys(WORKFLOW_SLA) },
  });

  const now = Date.now();

  for (const wf of workflows) {
    const rule = WORKFLOW_SLA[wf.state];
    if (!rule) continue;

    const enteredAt =
      wf.history?.slice().reverse().find(h => h.state === wf.state)?.at;

    if (!enteredAt) continue;

    const minutes =
      (now - new Date(enteredAt).getTime()) / 60000;

    if (minutes > rule.maxMinutes) {
      await logAudit({
        action: rule.alert,
        resource: "workflow",
        resourceId: wf._id,
        after: {
          state: wf.state,
          delayedMinutes: Math.round(minutes),
        },
      });
    }
  }
}
