import { getCapabilitiesWithMetadataForRole, getCapabilitiesByCategory, getCapabilitiesByModule } from "../config/capabilities.js";

/**
 * Get user's capabilities
 * POST /api/auth/capabilities or extend /me endpoint
 */
export const getUserCapabilities = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized",
      });
    }

    const capabilities = getCapabilitiesWithMetadataForRole(user.role);
    const capabilitiesByCategory = getCapabilitiesByCategory(user.role);
    const capabilitiesByModule = getCapabilitiesByModule(user.role);

    res.json({
      success: true,
      role: user.role,
      userId: user._id,
      capabilities: capabilities.map((cap) => cap.id),
      capabilitiesWithMetadata: capabilities,
      capabilitiesByCategory,
      capabilitiesByModule,
    });
  } catch (err) {
    console.error("Get capabilities error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to retrieve capabilities",
      error: err.message,
    });
  }
};

/**
 * Get all available capabilities (for admin/debugging)
 */
export const getAllCapabilities = async (req, res) => {
  try {
    // Only allow super admins to see all capabilities
    if (req.user?.role !== "SUPER_ADMIN" && req.user?.role !== "SYSTEM_ADMIN" && req.user?.role !== "DEVELOPER") {
      return res.status(403).json({
        success: false,
        msg: "Unauthorized",
      });
    }

    const { CAPABILITY_REGISTRY } = await import("../config/capabilities.js");
    res.json({
      success: true,
      capabilities: CAPABILITY_REGISTRY,
    });
  } catch (err) {
    console.error("Get all capabilities error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to retrieve capabilities",
      error: err.message,
    });
  }
};
