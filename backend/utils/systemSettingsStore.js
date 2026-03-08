import SystemSettings from "../models/SystemSettings.js";

export const SYSTEM_SETTINGS_KEY = "GLOBAL";

export async function getSystemSettingsDoc({ lean = false, createIfMissing = true } = {}) {
  let query = SystemSettings.findOne({ key: SYSTEM_SETTINGS_KEY });
  if (lean) query = query.lean();
  let doc = await query;
  if (doc) return doc;

  let fallback = lean ? await SystemSettings.findOne().lean() : await SystemSettings.findOne();
  if (fallback) {
    if (!fallback.key) {
      if (lean) {
        await SystemSettings.updateOne({ _id: fallback._id }, { $set: { key: SYSTEM_SETTINGS_KEY } });
        fallback = await SystemSettings.findById(fallback._id).lean();
      } else {
        fallback.key = SYSTEM_SETTINGS_KEY;
        await fallback.save();
      }
    }
    return fallback;
  }

  if (!createIfMissing) return null;

  if (lean) {
    await SystemSettings.create({ key: SYSTEM_SETTINGS_KEY });
    return SystemSettings.findOne({ key: SYSTEM_SETTINGS_KEY }).lean();
  }

  return SystemSettings.create({ key: SYSTEM_SETTINGS_KEY });
}

