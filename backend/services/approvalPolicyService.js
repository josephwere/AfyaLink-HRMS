import ApprovalPolicy from "../models/ApprovalPolicy.js";

export async function getPolicyForType({ hospitalId, workflowType, amount = 0 }) {
  if (!hospitalId || !workflowType) return null;
  const now = new Date();
  const policies = await ApprovalPolicy.find({ hospitalId, workflowType, status: "ACTIVE", effectiveDate: { $lte: now } }).sort({ effectiveDate: -1 });
  if (!policies || policies.length === 0) return null;

  // pick first policy that matches amount thresholds in any level, otherwise return first
  for (const p of policies) {
    if (!p.approvalLevels || p.approvalLevels.length === 0) return p;
    for (const lvl of p.approvalLevels) {
      if ((amount || 0) >= (lvl.minAmount || 0) && (amount || 0) <= (lvl.maxAmount || Number.MAX_SAFE_INTEGER)) {
        return p;
      }
    }
  }

  return policies[0];
}
