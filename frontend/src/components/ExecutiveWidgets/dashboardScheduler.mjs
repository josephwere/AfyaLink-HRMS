function normalizePolicy(policy) {
  return String(policy ?? 'MANUAL').toUpperCase();
}

function parseInterval(policy) {
  if (policy === 'INTERVAL_15S') return 15000;
  if (policy === 'INTERVAL_30S') return 30000;
  if (policy === 'INTERVAL_5M') return 300000;
  return null;
}

function createDashboardScheduler(options = {}) {
  const { onTick = async () => ({}) } = options;
  const timers = new Map();
  const diagnostics = {
    activeJobs: 0,
    scheduledJobs: 0,
    executions: 0,
    lastRunAt: null,
  };

  function schedule(job, policy = 'MANUAL') {
    const normalizedPolicy = normalizePolicy(policy);
    const intervalMs = parseInterval(normalizedPolicy);

    if (normalizedPolicy === 'MANUAL' || normalizedPolicy === 'STATIC' || normalizedPolicy === 'REALTIME') {
      return { id: `${job.id ?? 'job'}-manual`, policy: normalizedPolicy, intervalMs: null };
    }

    if (!intervalMs) {
      return { id: `${job.id ?? 'job'}-manual`, policy: normalizedPolicy, intervalMs: null };
    }

    const timerId = setInterval(() => {
      diagnostics.executions += 1;
      diagnostics.lastRunAt = Date.now();
      onTick(job);
    }, intervalMs);

    timers.set(timerId, { job, policy: normalizedPolicy, intervalMs });
    diagnostics.scheduledJobs += 1;

    return { id: timerId, policy: normalizedPolicy, intervalMs };
  }

  function cancel(id) {
    const timer = timers.get(id);
    if (timer) {
      clearInterval(id);
      timers.delete(id);
      diagnostics.scheduledJobs = Math.max(0, diagnostics.scheduledJobs - 1);
    }
  }

  function cancelAll() {
    timers.forEach((_, timerId) => clearInterval(timerId));
    timers.clear();
    diagnostics.scheduledJobs = 0;
  }

  function getDiagnostics() {
    return { ...diagnostics, activeTimers: timers.size };
  }

  return {
    schedule,
    cancel,
    cancelAll,
    getDiagnostics,
  };
}

export { createDashboardScheduler };
export default createDashboardScheduler;
