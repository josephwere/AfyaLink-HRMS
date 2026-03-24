import SettingsRevision from "../models/SettingsRevision.js";

const MAX_REVISIONS_PER_SCOPE = 40;

export async function recordSettingsRevision({
  scope,
  scopeId,
  hospitalId = null,
  actorId = null,
  actorRole = "",
  source = "manual-save",
  snapshot,
}) {
  if (!scope || !scopeId || !snapshot) return null;

  const revision = await SettingsRevision.create({
    scope,
    scopeId: String(scopeId),
    hospital: hospitalId || null,
    actorId: actorId || null,
    actorRole: actorRole || "",
    source,
    snapshot,
  });

  try {
    const stale = await SettingsRevision.find({ scope, scopeId: String(scopeId) })
      .sort({ createdAt: -1 })
      .skip(MAX_REVISIONS_PER_SCOPE)
      .select("_id")
      .lean();
    if (stale.length) {
      await SettingsRevision.deleteMany({ _id: { $in: stale.map((row) => row._id) } });
    }
  } catch {
    // Revision pruning should never block the main save path.
  }

  return revision;
}
