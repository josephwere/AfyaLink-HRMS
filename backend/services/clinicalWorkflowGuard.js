export function assertWorkflowState(workflow, allowedStates) {
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (!allowedStates.includes(workflow.state)) {
    throw new Error(
      `Action not allowed in workflow state: ${workflow.state}`
    );
  }
}
