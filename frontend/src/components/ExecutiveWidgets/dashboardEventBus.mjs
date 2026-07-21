function createDashboardEventBus() {
  const subscribers = new Map();

  function subscribe(eventName, listener) {
    const listeners = subscribers.get(eventName) ?? [];
    listeners.push(listener);
    subscribers.set(eventName, listeners);

    return () => {
      const next = (subscribers.get(eventName) ?? []).filter((item) => item !== listener);
      if (next.length) {
        subscribers.set(eventName, next);
      } else {
        subscribers.delete(eventName);
      }
    };
  }

  function publish(eventName, payload) {
    const listeners = subscribers.get(eventName) ?? [];
    listeners.forEach((listener) => listener(payload));
    return payload;
  }

  function clear() {
    subscribers.clear();
  }

  return {
    subscribe,
    publish,
    clear,
  };
}

export { createDashboardEventBus };
export default createDashboardEventBus;
