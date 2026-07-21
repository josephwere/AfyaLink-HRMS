export const DASHBOARD_DATA_REGISTRY = {
  facilitySummary: {
    id: "facilitySummary",
    refresh: 30000,
    cache: 15,
    refreshPolicy: "INTERVAL_30S",
    defaultData: {
      occupiedBeds: 0,
      totalBeds: 0,
      bedOccupancy: 0,
      admissionsToday: 0,
      dischargesToday: 0,
      revenueToday: "—",
    },
  },
  careSummary: {
    id: "careSummary",
    refresh: 30000,
    cache: 15,
    refreshPolicy: "INTERVAL_30S",
    defaultData: {
      admissionsToday: 0,
      dischargesToday: 0,
      escalations: 0,
    },
  },
  financeSummary: {
    id: "financeSummary",
    refresh: 60000,
    cache: 15,
    refreshPolicy: "INTERVAL_60S",
    defaultData: {
      revenueToday: "—",
      pendingClaims: 0,
      approvedClaims: 0,
    },
  },
  pharmacySummary: {
    id: "pharmacySummary",
    refresh: 45000,
    cache: 15,
    refreshPolicy: "INTERVAL_45S",
    defaultData: {
      alerts: 0,
      lowStock: 0,
    },
  },
  laboratorySummary: {
    id: "laboratorySummary",
    refresh: 30000,
    cache: 15,
    refreshPolicy: "INTERVAL_30S",
    defaultData: {
      queuedSamples: 0,
      pendingResults: 0,
    },
  },
  radiologySummary: {
    id: "radiologySummary",
    refresh: 30000,
    cache: 15,
    refreshPolicy: "INTERVAL_30S",
    defaultData: {
      queuedStudies: 0,
      urgentStudies: 0,
    },
  },
  workforceSummary: {
    id: "workforceSummary",
    refresh: 60000,
    cache: 15,
    refreshPolicy: "INTERVAL_60S",
    defaultData: {
      activeStaff: 0,
      onDuty: 0,
    },
  },
  emergencySummary: {
    id: "emergencySummary",
    refresh: 30000,
    cache: 15,
    refreshPolicy: "REALTIME",
    defaultData: {
      overrides: 0,
      activeAlerts: 0,
    },
  },
  deviceSummary: {
    id: "deviceSummary",
    refresh: 60000,
    cache: 15,
    refreshPolicy: "INTERVAL_60S",
    defaultData: {
      offlineDevices: 0,
      warningDevices: 0,
    },
  },
  complianceSummary: {
    id: "complianceSummary",
    refresh: 120000,
    cache: 15,
    refreshPolicy: "MANUAL",
    defaultData: {
      pendingAudits: 0,
      exceptions: 0,
    },
  },
};

export function buildDashboardData(rawData = {}, registry = DASHBOARD_DATA_REGISTRY) {
  const normalized = {};

  Object.entries(registry).forEach(([sourceId, config]) => {
    const sourceData = rawData?.[sourceId] ?? rawData ?? config.defaultData ?? {};
    normalized[sourceId] = sourceData;
  });

  return normalized;
}

export function getDataSourceConfig(sourceId, registry = DASHBOARD_DATA_REGISTRY) {
  return registry[sourceId] ?? null;
}
