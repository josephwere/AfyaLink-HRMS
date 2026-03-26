import SystemSettings from "../models/SystemSettings.js";
import { SYSTEM_SETTINGS_KEY } from "../utils/systemSettingsStore.js";
import { persistSystemSettingsAssets } from "../services/settingsAssetService.js";
import { getObjectStorageStatus } from "../services/objectStorageService.js";

const MIGRATION_KEY = "system_settings_assets_v1";

function hasMigrationFlag(migrations) {
  if (!migrations) return false;
  if (typeof migrations.get === "function") return Boolean(migrations.get(MIGRATION_KEY));
  return Boolean(migrations?.[MIGRATION_KEY]);
}

function toPlainSidebarIcons(value) {
  if (!value) return {};
  if (typeof value.toObject === "function") return value.toObject();
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value === "object") return value;
  return {};
}

function isDataUrl(value) {
  return /^data:[^;]+;base64,/i.test(String(value || ""));
}

function countDataUrls(record) {
  if (!record || typeof record !== "object") return 0;
  let count = 0;
  for (const value of Object.values(record)) {
    if (typeof value === "string" && isDataUrl(value)) count += 1;
  }
  return count;
}

export async function runSystemSettingsAssetMigration(logger = console) {
  const shouldRun =
    process.env.NODE_ENV !== "test" &&
    process.env.DISABLE_SETTINGS_ASSET_MIGRATION !== "1" &&
    !process.env.JEST_WORKER_ID;
  if (!shouldRun) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  try {
    const doc =
      (await SystemSettings.findOne({ key: SYSTEM_SETTINGS_KEY })) ||
      (await SystemSettings.findOne());

    if (!doc) {
      return { ok: true, skipped: true, reason: "missing-settings-doc" };
    }

    if (hasMigrationFlag(doc.migrations)) {
      return { ok: true, skipped: true, reason: "already-migrated" };
    }

    const branding = doc.branding?.toObject?.() || doc.branding || {};
    const ai = doc.ai?.toObject?.() || doc.ai || {};
    branding.sidebarIcons = toPlainSidebarIcons(branding.sidebarIcons);

    const dataUrlCount =
      countDataUrls({
        appIcon: branding.appIcon,
        favicon: branding.favicon,
        logo: branding.logo,
        loginBackground: branding.loginBackground,
        homeBackground: branding.homeBackground,
        aiIcon: ai.icon,
      }) + countDataUrls(branding.sidebarIcons);

    if (dataUrlCount === 0) {
      if (doc.migrations?.set) {
        doc.migrations.set(MIGRATION_KEY, { migratedAt: new Date().toISOString(), note: "no-data-urls" });
      } else {
        doc.migrations = { ...(doc.migrations || {}), [MIGRATION_KEY]: { migratedAt: new Date().toISOString(), note: "no-data-urls" } };
      }
      await doc.save();
      return { ok: true, migrated: 0 };
    }

    const storage = getObjectStorageStatus();
    logger.info?.(
      `[SETTINGS_ASSET_MIGRATION] detected ${dataUrlCount} data URL asset(s); provider=${storage.provider} configured=${storage.configured}`
    );

    const persisted = await persistSystemSettingsAssets({
      req: null,
      branding,
      ai,
    });

    let changed = false;

    if (persisted.branding && typeof persisted.branding === "object") {
      const { sidebarIcons, ...restBranding } = persisted.branding;
      doc.branding = { ...(doc.branding?.toObject?.() || doc.branding || {}), ...restBranding };
      if (sidebarIcons && typeof sidebarIcons === "object") {
        const current =
          doc.branding?.sidebarIcons?.toObject?.() ||
          doc.branding?.sidebarIcons ||
          {};
        doc.branding.sidebarIcons = { ...current, ...sidebarIcons };
      }
      changed = true;
    }

    if (persisted.ai && typeof persisted.ai === "object") {
      doc.ai = { ...(doc.ai?.toObject?.() || doc.ai || {}), ...persisted.ai };
      changed = true;
    }

    const flag = {
      migratedAt: new Date().toISOString(),
      provider: storage.provider,
      dataUrlCount,
    };
    if (doc.migrations?.set) {
      doc.migrations.set(MIGRATION_KEY, flag);
    } else {
      doc.migrations = { ...(doc.migrations || {}), [MIGRATION_KEY]: flag };
    }

    if (changed) {
      await doc.save();
    }

    logger.info?.("[SETTINGS_ASSET_MIGRATION] completed");
    return { ok: true, migrated: dataUrlCount };
  } catch (error) {
    logger.error?.("[SETTINGS_ASSET_MIGRATION] failed", error);
    return { ok: false, error: error?.message || String(error) };
  }
}

