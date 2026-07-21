export const WIDGET_REGISTRY = [
  {
    id: "bed-occupancy",
    title: "Bed occupancy",
    subtitle: "Capacity pressure and ward availability",
    capability: "facility.beds.view",
    priority: 1,
    refreshInterval: 30000,
    size: "large",
    dataSource: "facilitySummary",
  },
  {
    id: "admissions",
    title: "Admissions",
    subtitle: "Patient intake pulse",
    capability: "care.admissions.view",
    priority: 2,
    refreshInterval: 30000,
    size: "medium",
    dataSource: "careSummary",
  },
  {
    id: "discharges",
    title: "Discharges",
    subtitle: "Care transition flow",
    capability: "care.discharges.view",
    priority: 3,
    refreshInterval: 30000,
    size: "medium",
    dataSource: "careSummary",
  },
  {
    id: "revenue",
    title: "Revenue",
    subtitle: "Cash flow pulse",
    capability: "finance.revenue.view",
    priority: 4,
    refreshInterval: 60000,
    size: "medium",
    dataSource: "financeSummary",
  },
  {
    id: "claims",
    title: "Claims",
    subtitle: "Claims and reimbursement health",
    capability: "finance.claims.view",
    priority: 5,
    refreshInterval: 60000,
    size: "medium",
    dataSource: "financeSummary",
  },
  {
    id: "pharmacy",
    title: "Pharmacy alerts",
    subtitle: "Stock and dispensing risk",
    capability: "pharmacy.alerts.view",
    priority: 6,
    refreshInterval: 45000,
    size: "medium",
    dataSource: "pharmacySummary",
  },
  {
    id: "laboratory",
    title: "Laboratory queue",
    subtitle: "Specimen and turnaround pressure",
    capability: "lab.queue.view",
    priority: 7,
    refreshInterval: 30000,
    size: "medium",
    dataSource: "laboratorySummary",
  },
  {
    id: "radiology",
    title: "Radiology queue",
    subtitle: "Imaging throughput",
    capability: "radiology.queue.view",
    priority: 8,
    refreshInterval: 30000,
    size: "medium",
    dataSource: "radiologySummary",
  },
  {
    id: "staff",
    title: "Staff on duty",
    subtitle: "Coverage and staffing status",
    capability: "workforce.staff.view",
    priority: 9,
    refreshInterval: 60000,
    size: "medium",
    dataSource: "workforceSummary",
  },
  {
    id: "emergency",
    title: "Emergency overrides",
    subtitle: "Critical care interventions",
    capability: "operations.emergency.view",
    priority: 10,
    refreshInterval: 30000,
    size: "medium",
    dataSource: "emergencySummary",
  },
  {
    id: "machine-health",
    title: "Machine health",
    subtitle: "Device availability and alerts",
    capability: "operations.devices.view",
    priority: 11,
    refreshInterval: 60000,
    size: "medium",
    dataSource: "deviceSummary",
  },
  {
    id: "audit",
    title: "Audit summary",
    subtitle: "Governance and controls",
    capability: "compliance.audit.view",
    priority: 12,
    refreshInterval: 120000,
    size: "medium",
    dataSource: "complianceSummary",
  },
];

export const EXECUTIVE_LAYOUT = [
  ["bed-occupancy", "admissions"],
  ["discharges", "revenue"],
  ["claims", "pharmacy"],
  ["laboratory", "radiology"],
  ["staff", "emergency"],
  ["machine-health", "audit"],
];

export function getWidgetsForCapabilities(capabilities = [], registry = WIDGET_REGISTRY) {
  const availableCapabilities = new Set((capabilities || []).filter(Boolean));

  return registry
    .filter((widget) => {
      if (!widget.capability) return true;
      return availableCapabilities.size === 0 || availableCapabilities.has(widget.capability);
    })
    .sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999));
}

export function getLayoutWidgetIds(layout = EXECUTIVE_LAYOUT, widgets = getWidgetsForCapabilities()) {
  const allowedIds = new Set(widgets.map((widget) => widget.id));

  return layout.flatMap((row) => row.filter((widgetId) => allowedIds.has(widgetId)));
}

export function getWidgetById(widgetId, registry = WIDGET_REGISTRY) {
  return registry.find((widget) => widget.id === widgetId);
}
