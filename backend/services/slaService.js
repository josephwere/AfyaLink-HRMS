/**
 * SLA SERVICE
 * 🔒 Read-only
 * ⏱️ Workflow-history based
 */

export function calculateSLA(workflow, rules) {
  if (!workflow?.history?.length) return null;

  const now = Date.now();

  return rules.map((rule) => {
    const start = workflow.history.find(
      (h) => h.state === rule.start
    );

    if (!start) return null;

    const end = workflow.history.find(
      (h) => rule.end.includes(h.state)
    );

    const elapsedMs = end
      ? new Date(end.at) - new Date(start.at)
      : now - new Date(start.at);

    const breached = elapsedMs > rule.thresholdMs;

    return {
      name: rule.name,
      start: rule.start,
      end: end?.state || null,
      elapsedMs,
      thresholdMs: rule.thresholdMs,
      breached,
    };
  }).filter(Boolean);
}
