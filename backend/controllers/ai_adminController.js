import AuditLog from "../models/AuditLog.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

const DEFAULT_AI_ACTIONS = [
  "AI_DOCUMENT_EXTRACTED",
  "AI_DOCUMENT_EXTRACTION_FAILED",
  "AI_DIGITAL_TWIN_RUN",
  "AI_ASSISTANT_AUTOFILL_DRAFTED",
  "AI_ASSISTANT_AUTOFILL_APPLIED",
];

function parseActionFilters(query = {}) {
  const csv = String(query.actions || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const single = String(query.action || "").trim();
  const values = [...new Set([...(csv || []), ...(single ? [single] : [])])];
  return values.length ? values : DEFAULT_AI_ACTIONS;
}

export const index = async (_req, res) => {
  try {
    const settings = await getSystemSettingsDoc({ lean: true });
    const ai = settings?.ai || {};

    res.json({
      module: "ai_admin",
      status: "ok",
      ai: {
        enabled: Boolean(ai.enabled),
        name: ai.name || "NeuroEdge",
        provider: ai.provider || "NeuroEdge",
        model: ai.model || "neuroedge-core",
        url: ai.url || "",
        extractionEnabled: ai.extractionEnabled !== false,
        digitalTwinEnabled: ai.digitalTwinEnabled === true,
      },
      providers: {
        neuroEdgeConfigured: Boolean(ai.url),
        openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
        anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      },
    });
  } catch (err) {
    console.error("AI admin index error:", err);
    res.status(500).json({ msg: "Failed to load AI admin status" });
  }
};

export const list = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    const actions = parseActionFilters(req.query);
    const hospital = String(req.query?.hospital || "").trim();
    const hospitalKey = String(req.query?.hospitalKey || "").trim();
    const actorRole = String(req.user?.role || "").trim().toUpperCase();
    const scopedHospital = actorRole === "HOSPITAL_ADMIN" ? req.user?.hospital || req.user?.hospitalId || null : null;

    const filter = {
      ...(actions.length === 1 ? { action: actions[0] } : { action: { $in: actions } }),
      ...(scopedHospital ? { hospital: scopedHospital } : hospital ? { hospital } : {}),
      ...(hospitalKey
        ? {
            $or: [{ "metadata.hospitalKey": hospitalKey }, { "after.hospitalKey": hospitalKey }],
          }
        : {}),
    };

    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "actorId", select: "name email role" })
      .populate({ path: "hospital", select: "name code" })
      .select("action actorId actorRole resource after metadata hospital createdAt success error");

    const items = rows.map((row) => {
      const mergedMetadata = {
        ...(row.after || {}),
        ...(row.metadata || {}),
      };
      return {
        id: row._id,
        action: row.action,
        resource: row.resource || null,
        actor: row.actorId
          ? {
              id: row.actorId._id,
              name: row.actorId.name || null,
              email: row.actorId.email || null,
              role: row.actorId.role || row.actorRole || null,
            }
          : {
              id: null,
              name: null,
              email: null,
              role: row.actorRole || null,
            },
        hospital: row.hospital
          ? {
              id: row.hospital?._id || row.hospital,
              name: row.hospital?.name || null,
              code: row.hospital?.code || null,
            }
          : null,
        hospitalKey: mergedMetadata.hospitalKey || null,
        metadata: mergedMetadata,
        summary: mergedMetadata.summary || null,
        route: mergedMetadata.route || null,
        success: row.success !== false,
        error: row.error || null,
        createdAt: row.createdAt,
      };
    });

    return res.json({ items, limit, actions });
  } catch (err) {
    console.error("AI admin list error:", err);
    return res.status(500).json({ message: "Failed to load AI run logs" });
  }
};
