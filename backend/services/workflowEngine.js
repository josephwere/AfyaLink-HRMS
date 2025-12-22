import Workflow from "../models/Workflow.js";
import { WORKFLOW_TRANSITIONS } from "../config/workflows.js";
import { logAudit } from "./auditService.js";
import { triggerSideEffects } from "./workflowEffects.js";

/* ======================================================
   START WORKFLOW (ONLY ENTRY POINT)
====================================================== */
export async function startWorkflow({
  type,
  initialState,
  context = {},
  actor,
  hospital,
}) {
  const wf = await Workflow.create({
    type,
    state: initialState,
    context,
    hospital,
    history: [
      {
        state: initialState,
        at: new Date(),
        by: actor.id,
      },
    ],
  });

  await logAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "WORKFLOW_START",
    resource: "workflow",
    resourceId: wf.id,
    after: {
      type,
      state: initialState,
    },
    hospital,
  });

  // Side effects must NEVER mutate state
  await triggerSideEffects(initialState, wf, context);

  return wf;
}

/* ======================================================
   TRANSITION WORKFLOW (ONLY STATE MUTATION)
   🔐 Backend is the single authority
====================================================== */
export async function transitionWorkflow({
  workflowId,
  to,
  actor,
  ctx = {},
}) {
  const wf = await Workflow.findById(workflowId);
  if (!wf) {
    throw new Error("Workflow not found");
  }

  /* ----------------------------------
     🔐 Hospital isolation
  ---------------------------------- */
  if (String(wf.hospital) !== String(actor.hospitalId)) {
    throw new Error("Cross-hospital workflow access denied");
  }

  /* ----------------------------------
     🛑 Idempotency guard
     (double clicks / retries safe)
  ---------------------------------- */
  if (wf.state === to) {
    return wf;
  }

  /* ----------------------------------
     ✅ Transition validation
  ---------------------------------- */
  const allowed = WORKFLOW_TRANSITIONS[wf.state] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid workflow transition: ${wf.state} → ${to}`
    );
  }

  /* ----------------------------------
     🚦 Commit transition
  ---------------------------------- */
  wf.state = to;
  wf.context = {
    ...wf.context,
    ...ctx,
  };
  wf.history.push({
    state: to,
    at: new Date(),
    by: actor.id,
  });

  await wf.save();

  /* ----------------------------------
     🧾 Audit log
  ---------------------------------- */
  await logAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "WORKFLOW_TRANSITION",
    resource: "workflow",
    resourceId: wf.id,
    before: {
      state: wf.history.at(-2)?.state,
    },
    after: {
      state: to,
    },
    hospital: wf.hospital,
  });

  /* ----------------------------------
     ⚡ Side effects (async, safe)
  ---------------------------------- */
  await triggerSideEffects(to, wf, wf.context);

  return wf;
}

/* ======================================================
   COMPLETE WORKFLOW (TERMINAL)
====================================================== */
export async function completeWorkflow({
  workflowId,
  actor,
}) {
  const wf = await Workflow.findById(workflowId);
  if (!wf) {
    throw new Error("Workflow not found");
  }

  wf.completedAt = new Date();
  await wf.save();

  await logAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "WORKFLOW_COMPLETE",
    resource: "workflow",
    resourceId: wf.id,
    hospital: wf.hospital,
  });

  return wf;
}
