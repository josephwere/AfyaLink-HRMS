import SystemSettings from "../models/SystemSettings.js";

export const SYSTEM_SETTINGS_KEY = "GLOBAL";

export async function getSystemSettingsDoc({ lean = false, createIfMissing = true } = {}) {
  // Lean reads are on the critical path for auth/bootstrap (public branding).
  // They must be fast: no writes, no double round-trips.
  if (lean) {
    let doc = await SystemSettings.findOne({ key: SYSTEM_SETTINGS_KEY }).lean();
    if (!doc) {
      doc = await SystemSettings.findOne().lean();
    }
    if (doc) return doc;
    if (!createIfMissing) return null;
    const created = await SystemSettings.create({ key: SYSTEM_SETTINGS_KEY });
    return created.toObject?.() || created;
  }

  let doc = await SystemSettings.findOne({ key: SYSTEM_SETTINGS_KEY });
  if (!doc) {
    doc = await SystemSettings.findOne();
  }

  if (doc) {
    if (!doc.key) {
      doc.key = SYSTEM_SETTINGS_KEY;
    }
    let changed = false;
    const allowAutoEnable = !doc.ai?.disabledByAdmin;
    if (!doc.ai || typeof doc.ai.enabled !== "boolean") {
      doc.ai = { ...(doc.ai || {}), enabled: true, disabledByAdmin: false };
      changed = true;
    }
    if (allowAutoEnable && doc.ai?.enabled === false) {
      doc.ai.enabled = true;
      changed = true;
    }
    if (!doc.monetization) {
      doc.monetization = { featureAccess: { ai: "FREE" } };
      changed = true;
    } else if (!doc.monetization.featureAccess) {
      doc.monetization.featureAccess = { ai: "FREE" };
      changed = true;
    } else if (doc.monetization.featureAccess.get?.("ai") === "PREMIUM") {
      doc.monetization.featureAccess.set("ai", "FREE");
      changed = true;
    } else if (doc.monetization.featureAccess.ai === "PREMIUM") {
      doc.monetization.featureAccess.ai = "FREE";
      changed = true;
    } else if (!doc.monetization.featureAccess.get?.("ai") && !doc.monetization.featureAccess.ai) {
      if (doc.monetization.featureAccess.set) {
        doc.monetization.featureAccess.set("ai", "FREE");
      } else {
        doc.monetization.featureAccess.ai = "FREE";
      }
      changed = true;
    }
    if (changed) {
      await doc.save();
    }
    return doc;
  }

  if (!createIfMissing) return null;

  const created = await SystemSettings.create({ key: SYSTEM_SETTINGS_KEY });
  return created;
}
