import UsageLedgerEntry from "../models/UsageLedgerEntry.js";

function toNumber(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value, currency = "KES") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function buildDailySeries(entries, now) {
  const dayMap = new Map();
  const reference = new Date(now);
  const daysInMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    dayMap.set(key, 0);
  }

  (entries || []).forEach((entry) => {
    const createdAt = entry?.createdAt ? new Date(entry.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return;
    const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + toNumber(entry.amount, 0));
    }
  });

  return Array.from(dayMap.entries()).map(([date, total]) => ({ date, total }));
}

function buildFeatureBreakdown(entries) {
  const map = new Map();
  (entries || []).forEach((entry) => {
    const key = entry?.featureCode || entry?.serviceCode || entry?.feature || entry?.category || "OTHER";
    const current = map.get(key) || {
      category: key,
      featureCode: key,
      serviceCode: entry?.serviceCode || key,
      amount: 0,
      count: 0,
    };
    current.amount += toNumber(entry.amount, 0);
    current.count += 1;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export function buildUsageLedgerEntry({
  hospitalId,
  serviceCode,
  serviceName,
  category,
  quantity,
  unit,
  unitPrice,
  currency = "KES",
  createdAt = new Date(),
  metadata = {},
}) {
  const amount = toNumber(quantity, 0) * toNumber(unitPrice, 0);
  return {
    hospitalId,
    serviceCode,
    serviceName,
    category,
    quantity: toNumber(quantity, 0),
    unit,
    unitPrice: toNumber(unitPrice, 0),
    amount,
    currency,
    createdAt,
    metadata,
  };
}
export function buildHospitalFinancialIntelligence({
  hospital = {},
  hospitalId = null,
  invoiceMonth = null,
  dateFrom = null,
  dateTo = null,
  usageEntries = null,
  now = new Date(),
} = {}) {
  // Internal compute function used for both sync and async paths
  const compute = (entries) => {
    const billing = hospital?.billing || {};
    const monthlyTarget = toNumber(billing.monthlyTarget, 0);
    const currentSpend = (entries || []).reduce((sum, entry) => sum + toNumber(entry.amount, 0), 0);
    const remainingBudget = Math.max(0, monthlyTarget - currentSpend);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthEndSpend = Math.round((currentSpend / Math.max(1, now.getDate())) * daysInMonth);
    const featureBreakdown = buildFeatureBreakdown(entries);
    const dailySeries = buildDailySeries(entries, now);
    const outstandingBalance = toNumber(billing.balanceOutstanding, 0);
    const paymentDueAt = billing.paymentDueAt ? new Date(billing.paymentDueAt) : null;
    const targetExceeded = monthlyTarget > 0 && currentSpend > monthlyTarget;

    // Forecast confidence heuristic
    const daysObserved = dailySeries.filter((d) => d.total > 0).length;
    const dayOfMonth = now.getDate();
    let forecastConfidence = 50;
    if (dayOfMonth >= Math.max(1, Math.floor(daysInMonth * 0.75))) forecastConfidence = 95;
    else if (daysObserved >= Math.max(3, Math.floor(daysInMonth * 0.5))) forecastConfidence = 80;
    else if (daysObserved >= 1) forecastConfidence = 65;

    const suggestions = [];
    if (featureBreakdown.length) {
      const highest = featureBreakdown[0];
      suggestions.push({
        severity: "MEDIUM",
        code: "HIGH_VOLUME_FEATURE",
        message: `${highest.category} accounts for ${Math.round((highest.amount / Math.max(currentSpend, 1)) * 100)}% of your premium spending. Review usage patterns to reduce avoidable volume.`,
        feature: highest.category,
      });
    }
    if (targetExceeded) {
      suggestions.push({
        severity: "HIGH",
        code: "BUDGET_EXCEEDED",
        message: "Your current premium spend has already exceeded the monthly target. Consider tightening high-volume workflows or switching to lower-cost channels.",
      });
    }

    const optimizations = featureBreakdown
      .filter((f) => f.amount > 0)
      .slice(0, 3)
      .map((f) => ({
        feature: f.category,
        suggestedAction: f.amount > 10000 ? "REVIEW_PLAN_OVERRIDES" : "MONITOR_USAGE",
        reason: `This feature contributed ${Math.round((f.amount / Math.max(currentSpend, 1)) * 100)}% of spend.`,
      }));

    return {
      summary: {
        monthlyTarget,
        currentSpend,
        remainingBudget,
        outstandingBalance,
        paymentDueAt: paymentDueAt ? paymentDueAt.toISOString() : null,
        targetExceeded,
        currency: "KES",
        formatted: {
          monthlyTarget: formatCurrency(monthlyTarget),
          currentSpend: formatCurrency(currentSpend),
          remainingBudget: formatCurrency(remainingBudget),
          outstandingBalance: formatCurrency(outstandingBalance),
        },
      },
      forecast: {
        projectedMonthEndSpend,
        formattedProjectedMonthEndSpend: formatCurrency(projectedMonthEndSpend),
        currentDailyAverage: currentSpend / Math.max(now.getDate(), 1),
        confidence: forecastConfidence,
      },
      featureBreakdown,
      dailySeries,
      suggestions,
      optimizations,
      usageLedger: (entries || []).map((entry) => ({
        ...entry,
        formattedAmount: formatCurrency(toNumber(entry.amount, 0), entry.currency || "KES"),
      })),
    };
  };

  // If caller supplied usageEntries use sync path to preserve existing callers/tests
  if (Array.isArray(usageEntries)) {
    return compute(usageEntries);
  }

  // Otherwise return a Promise that resolves after querying the ledger
  const q = {};
  if (hospitalId) q.hospital = hospitalId;
  if (invoiceMonth) q.invoiceMonth = invoiceMonth;
  q.status = { $nin: ["VOID", "REVERSAL"] };

  if (!dateFrom || !dateTo) {
    const ref = new Date(now);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    dateFrom = dateFrom || start;
    dateTo = dateTo || end;
  }
  q.occurredAt = { $gte: new Date(dateFrom), $lt: new Date(dateTo) };

  return UsageLedgerEntry.find(q).lean().exec().then((found) => compute(found));
}
