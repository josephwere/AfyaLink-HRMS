import { getRevenueIntelligenceSnapshot } from "./revenueIntelligenceService.js";

export async function getFinanceSummary({ hospitalId = null } = {}) {
  const snapshot = await getRevenueIntelligenceSnapshot({ hospitalId });

  const revenueToday = Number(snapshot?.summary?.collectedAmount || 0);

  return {
    revenueToday: snapshot?.summary?.revenueToday || revenueToday,
    outstandingAmount: snapshot?.summary?.outstandingAmount || 0,
    collectedAmount: snapshot?.summary?.collectedAmount || 0,
    cancelledAmount: snapshot?.summary?.cancelledAmount || 0,
    invoiceCount: snapshot?.summary?.invoiceCount || 0,
    overdueInvoiceCount: snapshot?.summary?.overdueInvoiceCount || 0,
    totalClaims: snapshot?.summary?.totalClaims || 0,
    approvalRate: snapshot?.summary?.approvalRate || 0,
    denialRate: snapshot?.summary?.denialRate || 0,
    reviewRequiredCount: snapshot?.summary?.reviewRequiredCount || 0,
    highRiskClaimCount: snapshot?.summary?.highRiskClaimCount || 0,
    averageCollectionDays: snapshot?.summary?.averageCollectionDays || 0,
    totalPreauth: snapshot?.summary?.totalPreauth || 0,
    preauthApprovalRate: snapshot?.summary?.preauthApprovalRate || 0,
    pendingPreauthOverSla: snapshot?.summary?.pendingPreauthOverSla || 0,
    actions: snapshot?.actions || [],
  };
}

export default getFinanceSummary;
