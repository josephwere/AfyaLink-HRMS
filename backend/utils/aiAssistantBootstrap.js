import Hospital from "../models/Hospital.js";
import SystemSettings from "../models/SystemSettings.js";
import { SYSTEM_SETTINGS_KEY } from "./systemSettingsStore.js";

const MIGRATION_KEY = "ai_assistant_enable_v1";

export async function runAiAssistantBootstrap(logger = console) {
  const doc =
    (await SystemSettings.findOne({ key: SYSTEM_SETTINGS_KEY })) ||
    (await SystemSettings.findOne());

  if (!doc) {
    logger.warn("[AI_BOOTSTRAP] System settings missing; skipping.");
    return { ran: false, reason: "missing_settings" };
  }

  const migrations = doc.migrations?.toObject?.() || doc.migrations || {};
  if (migrations[MIGRATION_KEY]?.done) {
    return { ran: false, reason: "already_done" };
  }

  const hospitalRes = await Hospital.updateMany(
    {},
    {
      $set: {
        "features.ai": true,
        "customization.modules.showAI": true,
      },
    }
  );

  doc.ai = {
    ...(doc.ai || {}),
    enabled: true,
    disabledByAdmin: false,
  };

  if (!doc.monetization) {
    doc.monetization = { featureAccess: { ai: "FREE" } };
  } else if (!doc.monetization.featureAccess) {
    doc.monetization.featureAccess = { ai: "FREE" };
  } else if (doc.monetization.featureAccess.set) {
    doc.monetization.featureAccess.set("ai", "FREE");
  } else {
    doc.monetization.featureAccess.ai = "FREE";
  }

  migrations[MIGRATION_KEY] = {
    done: true,
    ranAt: new Date(),
    hospitalsMatched: hospitalRes?.matchedCount ?? hospitalRes?.n ?? 0,
    hospitalsModified: hospitalRes?.modifiedCount ?? hospitalRes?.nModified ?? 0,
  };
  doc.migrations = migrations;
  await doc.save();

  logger.info(
    `[AI_BOOTSTRAP] enabled AI for hospitals matched=${migrations[MIGRATION_KEY].hospitalsMatched} modified=${migrations[MIGRATION_KEY].hospitalsModified}`
  );

  return { ran: true, ...migrations[MIGRATION_KEY] };
}

