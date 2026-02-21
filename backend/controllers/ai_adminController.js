import SystemSettings from "../models/SystemSettings.js";
import AuditLog from "../models/AuditLog.js";

export const index = async (_req, res) => {
  try {
    const settings = await SystemSettings.findOne().lean();
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
    const action = String(req.query?.action || "AI_DOCUMENT_EXTRACTED").trim();
    const hospital = req.query?.hospital || null;

    const filter = {
      action,
      ...(hospital ? { hospital } : {}),
    };

    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "actorId", select: "name email role" })
      .select("action actorId actorRole after hospital createdAt success error");

    const items = rows.map((row) => ({
      id: row._id,
      action: row.action,
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
      hospital: row.hospital || null,
      metadata: row.after || null,
      success: row.success !== false,
      error: row.error || null,
      createdAt: row.createdAt,
    }));

    return res.json({ items, limit });
  } catch (err) {
    console.error("AI admin list error:", err);
    return res.status(500).json({ message: "Failed to load AI run logs" });
  }
};
