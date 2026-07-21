import { logAudit } from "./auditService.js";
import { notify } from "./notificationService.js";
import { orchestrateOperationalWorkflow } from "./operationalWorkflowOrchestrator.js";

const subscribers = new Map();
const websocketSubscribers = new Set();

function normalizeEvent(event) {
  if (!event || typeof event !== "object") {
    return { type: "UNKNOWN", payload: {} };
  }

  return {
    id: event.id || `${event.type || "event"}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: event.type,
    source: event.source || "unknown",
    hospitalId: event.hospitalId || event.hospital || null,
    actor: event.actor || null,
    entity: event.entity || null,
    correlationId: event.correlationId || null,
    traceId: event.traceId || null,
    metadata: event.metadata || {},
    payload: event.payload || {},
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

export function subscribeOperationalEvent(eventType, listener) {
  const listeners = subscribers.get(eventType) || [];
  listeners.push(listener);
  subscribers.set(eventType, listeners);

  return () => {
    const next = (subscribers.get(eventType) || []).filter((item) => item !== listener);
    if (next.length) {
      subscribers.set(eventType, next);
    } else {
      subscribers.delete(eventType);
    }
  };
}

export async function emitOperationalEvent(event) {
  const normalized = normalizeEvent(event);
  const listeners = subscribers.get(normalized.type) || [];

  await Promise.allSettled([
    (async () => {
      try {
        await orchestrateOperationalWorkflow(normalized);
      } catch (error) {
        console.error("Operational workflow orchestration failed", error);
      }
    })(),
    ...listeners.map((listener) => Promise.resolve(listener(normalized))),
    (async () => {
      try {
        await logAudit({
          action: normalized.type,
          resource: "operational_event",
          resourceId: normalized.payload?.resourceId || null,
          hospital: normalized.hospitalId,
          metadata: {
            eventId: normalized.id,
            payload: normalized.payload,
          },
        });
      } catch (error) {
        console.error("Operational event audit failed", error);
      }
    })(),
    (async () => {
      try {
        const notificationPayload = normalized.payload?.notification || null;
        if (notificationPayload) {
          await notify({
            hospital: normalized.hospitalId,
            title: notificationPayload.title || normalized.type,
            body: notificationPayload.body || normalized.type,
            category: notificationPayload.category || "SYSTEM",
            meta: notificationPayload.meta || {},
            user: notificationPayload.user || null,
          });
        }
      } catch (error) {
        console.error("Operational event notification failed", error);
      }
    })(),
    (async () => {
      try {
        const payload = {
          type: "operational_event",
          event: normalized,
        };
        const message = JSON.stringify(payload);
        for (const socket of Array.from(websocketSubscribers)) {
          if (socket.readyState === 1) {
            socket.send(message);
          }
        }
      } catch (error) {
        console.error("Operational event websocket fanout failed", error);
      }
    })(),
  ]);

  return normalized;
}

export function getOperationalEventSubscribers() {
  return Object.fromEntries(subscribers.entries());
}

export function registerOperationalWebSocketSubscriber(socket) {
  if (!socket) return () => {};
  websocketSubscribers.add(socket);
  return () => {
    websocketSubscribers.delete(socket);
  };
}

export default {
  subscribeOperationalEvent,
  emitOperationalEvent,
  getOperationalEventSubscribers,
  registerOperationalWebSocketSubscriber,
};
