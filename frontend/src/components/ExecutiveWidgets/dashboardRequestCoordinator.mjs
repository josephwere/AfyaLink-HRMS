function createDashboardRequestCoordinator(options = {}) {
  const { fetcher = async () => ({}) } = options;
  const requests = new Map();
  const diagnostics = {
    active: 0,
    completed: 0,
    failed: 0,
    retried: 0,
    cancelled: 0,
    timeouts: 0,
  };

  async function request(requestConfig = {}) {
    const {
      source,
      priority = 'normal',
      cachePolicy,
      timeoutMs = 8000,
      retries = 0,
      signal,
      payload,
      data,
      context,
      widgets,
      sourceConfig,
      refreshPolicy,
    } = requestConfig;
    const requestId = `${source}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const controller = new AbortController();
    const combinedSignal = signal ?? controller.signal;

    const existing = requests.get(source);
    if (existing) {
      return existing.promise;
    }

    const requestEntry = {
      id: requestId,
      source,
      priority,
      cachePolicy,
      timeoutMs,
      retries,
      signal: combinedSignal,
      promise: null,
      controller,
    };

    requests.set(source, requestEntry);
    diagnostics.active += 1;

    requestEntry.promise = (async () => {
      let attempt = 0;
      let lastError = null;

      while (attempt <= retries) {
        if (combinedSignal?.aborted) {
          diagnostics.cancelled += 1;
          throw new Error('Request cancelled');
        }

        try {
          const timeout = setTimeout(() => {
            controller.abort();
            diagnostics.timeouts += 1;
          }, timeoutMs);

          const value = await fetcher(source, payload ?? data ?? {}, {
            signal: combinedSignal,
            priority,
            cachePolicy,
            requestId,
            context,
            widgets,
            sourceConfig,
            refreshPolicy,
          });
          clearTimeout(timeout);

          diagnostics.completed += 1;
          return value;
        } catch (error) {
          lastError = error;
          if (attempt < retries) {
            diagnostics.retried += 1;
            await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          }
        }

        attempt += 1;
      }

      diagnostics.failed += 1;
      throw lastError ?? new Error(`Request failed for ${source}`);
    })().finally(() => {
      requests.delete(source);
      diagnostics.active = Math.max(0, diagnostics.active - 1);
    });

    return requestEntry.promise;
  }

  async function batch(requestsToProcess = []) {
    return Promise.all(requestsToProcess.map((requestConfig) => request(requestConfig)));
  }

  function cancel(requestId) {
    const entry = Array.from(requests.values()).find((item) => item.id === requestId);
    if (entry) {
      entry.controller.abort();
      diagnostics.cancelled += 1;
    }
  }

  function flush() {
    requests.clear();
  }

  function getDiagnostics() {
    return { ...diagnostics, pending: requests.size };
  }

  return {
    request,
    batch,
    cancel,
    flush,
    getDiagnostics,
  };
}

export { createDashboardRequestCoordinator };
export default createDashboardRequestCoordinator;
