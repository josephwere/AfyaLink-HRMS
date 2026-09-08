function toNumber(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value, currency = "KES") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

export function buildBillingSnapshot({ hospital = {}, usageEntries = [], now = new Date() } = {}) {
  const currentSpend = (usageEntries || []).reduce((sum, entry) => sum + toNumber(entry.amount, 0), 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedMonthEndSpend = Math.round((currentSpend / Math.max(1, now.getDate())) * daysInMonth);
  return {
    hospitalId: hospital?._id || hospital || null,
    currentSpend,
    forecast: {
      projectedMonthEndSpend,
      formattedProjectedMonthEndSpend: formatCurrency(projectedMonthEndSpend),
    },
    dailySpend: currentSpend,
    weeklySpend: currentSpend,
    monthlySpend: currentSpend,
    outstandingBalance: 0,
    budgetUsage: 0,
    revenue: currentSpend,
  };
}

export function buildInvoiceFromLedger({ hospital = {}, usageEntries = [], invoiceNumber = "INV-0001", period = "CURRENT" } = {}) {
  const items = (usageEntries || []).map((entry) => ({
    featureCode: entry?.featureCode || entry?.serviceCode || entry?.feature || null,
    serviceName: entry?.serviceName || entry?.featureName || entry?.feature || "Premium Service",
    quantity: toNumber(entry.quantity, 0),
    unitPrice: toNumber(entry.unitPrice, 0),
    amount: toNumber(entry.amount, 0),
    currency: entry?.currency || "KES",
  }));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return {
    invoiceNumber,
    hospitalId: hospital?._id || hospital || null,
    period,
    items,
    total,
    currency: "KES",
    status: "DRAFT",
  };
}
