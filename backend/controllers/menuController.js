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
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    /* ================= LOAD HOSPITAL FEATURES ================= */
    let features = {};

    if (user.hospital) {
      const hospital = await Hospital.findOne({
        _id: user.hospital,
        active: true, // 🔒 SOFT-DELETE SAFE
      })
        .select("features")
        .lean();

      if (!hospital) {
        // Hospital deactivated → no access
        return res.json({
          role: user.role,
          hospital: null,
          menu: [],
        });
      }

      features = hospital.features || {};
    }

    /* ================= FILTER MENU ================= */
    const menu = MENU
      .filter((section) => {
        if (section.roles && !section.roles.includes(user.role)) return false;
        if (section.feature && !features[section.feature]) return false;
        return true;
      })
      .map((section) => {
        const items = section.items.filter((item) => {
          if (item.feature && !features[item.feature]) return false;
          if (item.hidden && user.role !== "SUPER_ADMIN") return false;
          return true;
        });

        return {
          section: section.section,
          items,
        };
      })
      .filter((section) => section.items.length > 0);

    const response = {
      role: user.role,
      hospital: user.hospital || null,
      menu,
    };

    /* ================= CACHE STORE ================= */
    await cacheSet(cacheKey, JSON.stringify(response), 300); // 5 min

    res.json(response);
  } catch (err) {
    console.error("Menu error:", err);
    res.status(500).json({ message: "Failed to load menu" });
  }
};
