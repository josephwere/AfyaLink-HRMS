import { emitOperationalEvent } from "./operationalEventGateway.js";

export async function emitTelemedicineEvent(event) {
  const normalized = {
    ...event,
    type: event?.type || "TELEMEDICINE_EVENT",
    source: event?.source || "telemedicine-service",
    metadata: {
      ...(event?.metadata || {}),
      source: "telemedicine",
    },
  };

  return emitOperationalEvent(normalized);
}
