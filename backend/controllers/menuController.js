import Hospital from "../models/Hospital.js";
import { MENU } from "../config/menuConfig.js";
import { cacheGet, cacheSet } from "../utils/cache.js";

export const getMenu = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    /* ================= CACHE KEY ================= */
    const cacheKey = `menu:${user._id}:${user.role}:${user.hospital || "none"}`;

    /* ================= CACHE HIT ================= */
    const cachedMenu = await cacheGet(cacheKey);
    if (cachedMenu) {
      return res.json(cachedMenu);
    }

    /* ================= LOAD HOSPITAL FEATURES ================= */
    let features = {};

    if (user.hospital) {
      const hospital = await Hospital.findById(user.hospital)
        .select("features")
        .lean();

      features = hospital?.features || {};
    }

    /* ================= FILTER MENU ================= */
    const menu = MENU
      .filter((section) => {
        // Role-based visibility
        if (section.roles && !section.roles.includes(user.role)) {
          return false;
        }

        // Section-level feature toggle
        if (section.feature && !features[section.feature]) {
          return false;
        }

        return true;
      })
      .map((section) => {
        const items = section.items.filter((item) => {
          // Feature toggle per item
          if (item.feature && !features[item.feature]) {
            return false;
          }

          // Hidden items → SUPER_ADMIN only
          if (item.hidden && user.role !== "SUPER_ADMIN") {
            return false;
          }

          return true;
        });

        return {
          section: section.section,
          items,
        };
      })
      .filter((section) => section.items.length > 0); // no empty sections

    const response = {
      role: user.role,
      hospital: user.hospital || null,
      menu,
    };

    /* ================= CACHE STORE ================= */
    await cacheSet(cacheKey, response, 300); // 5 minutes

    /* ================= RESPONSE ================= */
    res.json(response);
  } catch (err) {
    console.error("Menu error:", err);
    res.status(500).json({ message: "Failed to load menu" });
  }
};
