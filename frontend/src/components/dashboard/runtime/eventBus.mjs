export function createDashboardEventChannel() {
  const eventListeners = new Map();
  const allListeners = new Set();

  const subscribe = (eventName, listener) => {
    if (typeof listener !== "function") return () => {};
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    const listeners = eventListeners.get(eventName);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        eventListeners.delete(eventName);
      }
    };
  };

  const subscribeAll = (listener) => {
    if (typeof listener !== "function") return () => {};
    allListeners.add(listener);
    return () => {
      allListeners.delete(listener);
    };
  };

  const publish = (eventName, detail = {}, meta = {}) => {
    const payload = {
      eventName,
      detail,
      meta,
      timestamp: Date.now(),
    };

    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(payload);
        } catch {
          // Intentionally swallow listener exceptions to keep the runtime resilient.
        }
      });
    }

    allListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch {
        // Intentionally swallow listener exceptions to keep the runtime resilient.
      }
    });

    return payload;
  };

  return {
    publish,
    subscribe,
    subscribeAll,
  };
}
