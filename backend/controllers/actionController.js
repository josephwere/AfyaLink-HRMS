import AuditLog from "../models/AuditLog.js";

export const triggerAction = async (req, res) => {
  try {
    const { action, meta } = req.body || {};

    if (!action) {
      return res.status(400).json({ message: "Action is required" });
    }

    await AuditLog.create({
      actorId: req.user?.id || req.user?._id,
      actorRole: req.user?.role,
      action,
      resource: "UI_ACTION",
      resourceId: null,
      metadata: meta || {},
      success: true,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Action trigger error:", err);
    res.status(500).json({ message: "Failed to trigger action" });
  }
};
