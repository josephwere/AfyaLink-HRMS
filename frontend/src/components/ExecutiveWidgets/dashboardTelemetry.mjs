function createDashboardTelemetry() {
  const events = {};
  const latencyMs = {};

  function record(eventName, payload = {}) {
    events[eventName] = (events[eventName] ?? 0) + 1;
    if (payload?.durationMs != null) {
      latencyMs[eventName] = payload.durationMs;
    }
    return { eventName, payload };
  }

  function getSummary() {
    return {
      events: { ...events },
      latencyMs: { ...latencyMs },
    };
  }

  return {
    record,
    getSummary,
  };
}

export { createDashboardTelemetry };
export default createDashboardTelemetry;
