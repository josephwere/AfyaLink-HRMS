import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import User from "../models/User.js";

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const artifactsRoot = path.resolve(workerDir, "..", "artifacts");

function parseDays(value, fallback) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? days : fallback;
}

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }

  return files;
}

async function removeEmptyDirsRecursive(dir, rootDir) {
  if (path.resolve(dir) === path.resolve(rootDir)) return;
  try {
    const entries = await fs.readdir(dir);
    if (entries.length > 0) return;
    await fs.rmdir(dir);
    await removeEmptyDirsRecursive(path.dirname(dir), rootDir);
  } catch {
    // Ignore dir cleanup failures; file retention is the primary goal.
  }
}

export async function purgeDeletedAccounts() {
  const retentionDays = parseDays(process.env.DELETED_ACCOUNT_PURGE_DAYS, 30);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await User.deleteMany({
    active: false,
    protectedAccount: { $ne: true },
    "metadata.accountDeletedBySelf": true,
    "metadata.accountDeletedAt": { $lte: cutoff.toISOString() },
  });

  return {
    retentionDays,
    cutoff,
    deletedCount: Number(result?.deletedCount || 0),
  };
}

export async function cleanupExportArtifacts() {
  const retentionDays = parseDays(process.env.EXPORT_ARTIFACT_RETENTION_DAYS, 7);
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const configuredDirs = String(
    process.env.EXPORT_ARTIFACT_DIRS || "account-exports,exports"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let deletedFiles = 0;

  for (const relativeDir of configuredDirs) {
    const absoluteDir = path.resolve(artifactsRoot, relativeDir);
    try {
      const files = await listFilesRecursive(absoluteDir);
      for (const filePath of files) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs <= cutoffMs) {
            await fs.unlink(filePath);
            deletedFiles += 1;
            await removeEmptyDirsRecursive(path.dirname(filePath), absoluteDir);
          }
        } catch {
          // Ignore single-file errors and continue sweeping the directory.
        }
      }
    } catch {
      // Missing export artifact directories are fine.
    }
  }

  return {
    retentionDays,
    deletedFiles,
  };
}

export async function runDataRetentionCleanup() {
  try {
    const [accountPurge, exportArtifacts] = await Promise.all([
      purgeDeletedAccounts(),
      cleanupExportArtifacts(),
    ]);

    if (accountPurge.deletedCount > 0 || exportArtifacts.deletedFiles > 0) {
      console.log(
        `[DATA_RETENTION] purged_accounts=${accountPurge.deletedCount} deleted_export_artifacts=${exportArtifacts.deletedFiles}`
      );
    }

    return {
      ok: true,
      accountPurge,
      exportArtifacts,
    };
  } catch (error) {
    console.error("[DATA_RETENTION] cleanup failed", error);
    return {
      ok: false,
      error: error?.message || "unknown",
    };
  }
}
