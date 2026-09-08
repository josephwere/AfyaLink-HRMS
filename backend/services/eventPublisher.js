import EventEmitter from "events";

const emitter = new EventEmitter();

let bullQueue = null;
let useBull = false;

if (process.env.USE_BULLMQ === "1") {
  try {
    // Lazy require to avoid breaking environments without bullmq
    const { Queue } = await import("bullmq");
    const connection = process.env.REDIS_URL || process.env.REDIS_HOST || "redis://127.0.0.1:6379";
    bullQueue = new Queue("revenue-events", { connection: { connectionString: connection } });
    useBull = true;
  } catch (err) {
    // Fallback to local emitter
    // console.warn("BullMQ unavailable, falling back to local emitter", err?.message || err);
  }
}

export async function publish(eventName, payload = {}) {
  try {
    // local synchronous emit
    emitter.emit(eventName, payload);

    if (useBull && bullQueue) {
      await bullQueue.add(eventName, { event: eventName, payload }, { removeOnComplete: true, removeOnFail: true });
    }

    return true;
  } catch (err) {
    // swallow to avoid breaking billing flow
    return false;
  }
}

export function subscribe(eventName, handler) {
  emitter.on(eventName, handler);
}

export function getEmitter() {
  return emitter;
}

export default { publish, subscribe, getEmitter };
