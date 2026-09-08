import OutboxEvent from "../models/OutboxEvent.js";
import eventPublisher, { publish } from "./eventPublisher.js";

const MAX_ATTEMPTS = 5;

function nextAttemptAt(attempts = 0) {
  const backoffMs = Math.min(1000 * 2 ** attempts, 30 * 60 * 1000);
  return new Date(Date.now() + backoffMs);
}

export async function processPendingOutboxEvents({ limit = 50, now = new Date() } = {}) {
  const query = OutboxEvent.find({
    status: "PENDING",
    $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }],
  });

  const pendingEvents = typeof query.limit === "function"
    ? await query.limit(limit).lean()
    : await query;

  for (const event of pendingEvents) {
    try {
      const ok = await publish(event.eventName, event.payload || {});
      if (ok) {
        await OutboxEvent.findByIdAndUpdate(event._id, {
          $set: {
            status: "SENT",
            attempts: Number(event.attempts || 0) + 1,
            updatedAt: new Date(),
            nextAttemptAt: null,
          },
        });
        continue;
      }

      const nextAttemptCount = Number(event.attempts || 0) + 1;
      const status = nextAttemptCount >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
      await OutboxEvent.findByIdAndUpdate(event._id, {
        $set: {
          attempts: nextAttemptCount,
          lastError: "Publish returned false",
          nextAttemptAt: status === "PENDING" ? nextAttemptAt(nextAttemptCount) : null,
          status,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      const nextAttemptCount = Number(event.attempts || 0) + 1;
      const status = nextAttemptCount >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
      await OutboxEvent.findByIdAndUpdate(event._id, {
        $set: {
          attempts: nextAttemptCount,
          lastError: error?.message || String(error),
          nextAttemptAt: status === "PENDING" ? nextAttemptAt(nextAttemptCount) : null,
          status,
          updatedAt: new Date(),
        },
      });
    }
  }

  return pendingEvents.length;
}

export function startOutboxWorker({ intervalMs = 5000 } = {}) {
  const timer = setInterval(() => {
    processPendingOutboxEvents().catch(() => {});
  }, intervalMs);

  return () => clearInterval(timer);
}

export default { processPendingOutboxEvents, startOutboxWorker };
