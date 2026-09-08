import { v4 as uuidv4 } from "uuid";
import { resolveFeatureCode, getFeatureDefinition } from "./featureRegistryService.js";

function toNumber(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

export function buildUsageEvent({
  hospital,
  feature,
  featureCode,
  quantity,
  unit = "unit",
  metadata = {},
  occurredAt = new Date(),
  requestId,
  userId,
  patientId,
} = {}) {
  const resolvedFeatureCode = resolveFeatureCode(featureCode || feature) || "CUSTOM";
  const definition = getFeatureDefinition({ key: resolvedFeatureCode });
  return {
    eventId: uuidv4(),
    requestId: requestId || null,
    hospitalId: hospital?._id || hospital || null,
    userId: userId || null,
    patientId: patientId || null,
    featureCode: resolvedFeatureCode,
    feature: String(feature || featureCode || resolvedFeatureCode || "UNKNOWN").toUpperCase(),
    featureName: definition?.label || String(feature || featureCode || "Custom Premium Usage"),
    quantity: toNumber(quantity, 0),
    unit: String(unit || definition?.unit || "unit"),
    metadata,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
  };
}
