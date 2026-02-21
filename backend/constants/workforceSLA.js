export const WORKFORCE_SLA_DEFAULTS = {
  LEAVE: {
    targetMinutes: 24 * 60,
    escalationMinutes: 48 * 60,
    active: true,
  },
  OVERTIME: {
    targetMinutes: 12 * 60,
    escalationMinutes: 24 * 60,
    active: true,
  },
  SHIFT: {
    targetMinutes: 8 * 60,
    escalationMinutes: 16 * 60,
    active: true,
  },
};

export const WORKFORCE_REQUEST_TYPES = Object.freeze(
  Object.keys(WORKFORCE_SLA_DEFAULTS)
);
