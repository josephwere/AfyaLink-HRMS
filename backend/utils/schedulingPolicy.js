export const DEFAULT_SCHEDULING_POLICY = Object.freeze({
  bookingHorizonDays: 30,
  cancellationCutoffHours: 24,
  dailyDoctorCapacity: 30,
  maximumQueueSize: 50,
  waitlistEnabled: true,
  emergencySlotPercentage: 15,
  autoAssignmentEnabled: true,
  workloadBalancingEnabled: true,
  prioritySchedulingEnabled: false,
  weekendBookingEnabled: true,
  queueAlertThreshold: 10,
});

function toBoundedNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

export function normalizeSchedulingPolicy(input = {}, current = DEFAULT_SCHEDULING_POLICY) {
  const source = { ...DEFAULT_SCHEDULING_POLICY, ...(current || {}), ...(input || {}) };
  return {
    bookingHorizonDays: toBoundedNumber(source.bookingHorizonDays, DEFAULT_SCHEDULING_POLICY.bookingHorizonDays, 1, 365),
    cancellationCutoffHours: toBoundedNumber(source.cancellationCutoffHours, DEFAULT_SCHEDULING_POLICY.cancellationCutoffHours, 0, 720),
    dailyDoctorCapacity: toBoundedNumber(source.dailyDoctorCapacity, DEFAULT_SCHEDULING_POLICY.dailyDoctorCapacity, 1, 200),
    maximumQueueSize: toBoundedNumber(source.maximumQueueSize, DEFAULT_SCHEDULING_POLICY.maximumQueueSize, 1, 10000),
    waitlistEnabled: toBoolean(source.waitlistEnabled, DEFAULT_SCHEDULING_POLICY.waitlistEnabled),
    emergencySlotPercentage: toBoundedNumber(source.emergencySlotPercentage, DEFAULT_SCHEDULING_POLICY.emergencySlotPercentage, 0, 80),
    autoAssignmentEnabled: toBoolean(source.autoAssignmentEnabled, DEFAULT_SCHEDULING_POLICY.autoAssignmentEnabled),
    workloadBalancingEnabled: toBoolean(source.workloadBalancingEnabled, DEFAULT_SCHEDULING_POLICY.workloadBalancingEnabled),
    prioritySchedulingEnabled: toBoolean(source.prioritySchedulingEnabled, DEFAULT_SCHEDULING_POLICY.prioritySchedulingEnabled),
    weekendBookingEnabled: toBoolean(source.weekendBookingEnabled, DEFAULT_SCHEDULING_POLICY.weekendBookingEnabled),
    queueAlertThreshold: toBoundedNumber(source.queueAlertThreshold, DEFAULT_SCHEDULING_POLICY.queueAlertThreshold, 1, 10000),
  };
}

export function isSchedulingPolicyQueueNearCapacity({ pendingQueueSize = 0, policy = DEFAULT_SCHEDULING_POLICY }) {
  const normalized = normalizeSchedulingPolicy(policy);
  return Number(pendingQueueSize || 0) >= normalized.queueAlertThreshold;
}
