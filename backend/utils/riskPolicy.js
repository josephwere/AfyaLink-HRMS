import RiskPolicy from "../models/RiskPolicy.js";

const DEFAULT_POLICY = {
  key: "GLOBAL",
  enabled: true,
  thresholds: { medium: 40, high: 70, critical: 90 },
  scores: {
    missingDeviceFingerprint: 15,
    newDevice: 30,
    userAgentChanged: 10,
    newNetworkPrefix: 35,
    impossibleTravel: 45,
  },
  impossibleTravelWindowMinutes: 90,
  restrictionMinutes: 30,
  stepUpWindowMinutes: 15,
};

let cache = { value: DEFAULT_POLICY, at: 0 };
const TTL_MS = 60 * 1000;

export async function getRiskPolicy() {
  if (Date.now() - cache.at < TTL_MS) return cache.value;
  const doc = await RiskPolicy.findOne({ key: "GLOBAL" }).lean();
  cache = { value: doc || DEFAULT_POLICY, at: Date.now() };
  return cache.value;
}

export async function upsertRiskPolicy(payload, updatedBy = null) {
  const next = {
    enabled: payload?.enabled ?? true,
    thresholds: {
      medium: Number(payload?.thresholds?.medium ?? DEFAULT_POLICY.thresholds.medium),
      high: Number(payload?.thresholds?.high ?? DEFAULT_POLICY.thresholds.high),
      critical: Number(payload?.thresholds?.critical ?? DEFAULT_POLICY.thresholds.critical),
    },
    scores: {
      missingDeviceFingerprint: Number(
        payload?.scores?.missingDeviceFingerprint ?? DEFAULT_POLICY.scores.missingDeviceFingerprint
      ),
      newDevice: Number(payload?.scores?.newDevice ?? DEFAULT_POLICY.scores.newDevice),
      userAgentChanged: Number(
        payload?.scores?.userAgentChanged ?? DEFAULT_POLICY.scores.userAgentChanged
      ),
      newNetworkPrefix: Number(
        payload?.scores?.newNetworkPrefix ?? DEFAULT_POLICY.scores.newNetworkPrefix
      ),
      impossibleTravel: Number(
        payload?.scores?.impossibleTravel ?? DEFAULT_POLICY.scores.impossibleTravel
      ),
    },
    impossibleTravelWindowMinutes: Number(
      payload?.impossibleTravelWindowMinutes ?? DEFAULT_POLICY.impossibleTravelWindowMinutes
    ),
    restrictionMinutes: Number(payload?.restrictionMinutes ?? DEFAULT_POLICY.restrictionMinutes),
    stepUpWindowMinutes: Number(payload?.stepUpWindowMinutes ?? DEFAULT_POLICY.stepUpWindowMinutes),
    updatedBy: updatedBy || null,
  };

  const policy = await RiskPolicy.findOneAndUpdate(
    { key: "GLOBAL" },
    { $set: next, $setOnInsert: { key: "GLOBAL" } },
    { upsert: true, new: true }
  ).lean();
  cache = { value: policy, at: Date.now() };
  return policy;
}

