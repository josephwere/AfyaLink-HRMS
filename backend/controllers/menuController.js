import Hospital from "../models/Hospital.js";
import DelegatedPermission from "../models/DelegatedPermission.js";
import { MENU } from "../config/menuConfig.js";
import { cacheGet, cacheSet } from "../utils/cache.js";
import { isBreakGlassActive } from "../utils/breakGlass.js"; // 🚨 ADD
import { getPermissionByPath } from "../utils/menuCatalog.js";

function applyDelegatedPermissions(menu, grants = []) {
  if (!Array.isArray(grants) || !grants.length) return menu;

  const denied = new Set(
    grants
      .filter((g) => g?.effect === "DENY" && g?.active !== false && g?.permissionKey)
      .map((g) => g.permissionKey)
  );

  const allowed = new Set(
    grants
      .filter((g) => g?.effect === "ALLOW" && g?.active !== false && g?.permissionKey)
      .map((g) => g.permissionKey)
  );

  // DENY always wins over ALLOW for safety.
  for (const path of denied) {
    allowed.delete(path);
  }

  const visible = menu.map((section) => ({
    ...section,
    items: (section.items || []).filter((item) => !denied.has(item.path)),
  }));

  const existingPaths = new Set(
    visible.flatMap((section) => (section.items || []).map((item) => item.path).filter(Boolean))
  );

  const delegatedItems = [];
  for (const path of allowed) {
    if (existingPaths.has(path)) continue;
    const meta = getPermissionByPath(path);
    delegatedItems.push({
      label: meta?.label || path,
      path,
      icon: meta?.icon || "settings",
    });
  }

  if (delegatedItems.length) {
    visible.push({
      section: "Delegated Access",
      items: delegatedItems.sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  return visible.filter((section) => (section.items || []).length > 0);
}

export const getMenu = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const isSuperAdmin = user.role === "SUPER_ADMIN";

    /* ================= EMERGENCY CHECK ================= */
    const emergencyActive = await isBreakGlassActive(user.hospital);

    /* ================= CACHE KEY ================= */
    const cacheKey = `menu:${user._id}:${user.role}:${user.hospital || "none"}:${emergencyActive}`;

    /* ================= CACHE HIT ================= */
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
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

      if (!hospital && !isSuperAdmin) {
        return res.json({
          role: user.role,
          hospital: null,
          menu: [],
        });
      }

      features = hospital?.features || {};
    }

    /* ================= FILTER MENU ================= */
    let menu = MENU
      .filter((section) => {
        if (section.roles && !section.roles.includes(user.role)) return false;
        if (section.feature && !features[section.feature] && !isSuperAdmin)
          return false;
        return true;
      })
      .map((section) => {
        const items = section.items.filter((item) => {
          if (item.roles && !item.roles.includes(user.role)) return false;
          if (item.feature && !features[item.feature] && !isSuperAdmin)
            return false;
          if (item.hidden && !isSuperAdmin) return false;
          return true;
        });

        return {
          section: section.section,
          items,
        };
      })
      .filter((section) => section.items.length > 0);

    // De-duplicate menu links across sections so users never see repeated entries.
    const seen = new Set();
    menu = menu
      .map((section) => {
        const items = section.items.filter((item) => {
          if (!item.path) return true;
          const key = item.path;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return { ...section, items };
      })
      .filter((section) => section.items.length > 0);

    // Apply hierarchical delegated access rules (allow/deny).
    const delegated = await DelegatedPermission.find({
      grantee: user._id,
      active: true,
      $or: [{ hospital: user.hospital || null }, { hospital: null }],
    })
      .select("permissionKey effect action active")
      .lean();
    menu = applyDelegatedPermissions(menu, delegated);

    /* ================= 🚨 EMERGENCY MENU INJECTION ================= */
    if (emergencyActive) {
      menu.unshift({
        section: "🚨 Emergency Mode",
        emergency: true,
        items: [
          {
            label: "Emergency Access Active",
            badge: "ACTIVE",
            severity: "danger",
            readonly: true,
          },
        ],
      });
    }

    const response = {
      role: user.role,
      hospital: user.hospital || null,
      emergencyActive,
      menu,
    };

    /* ================= CACHE STORE ================= */
    await cacheSet(cacheKey, response, 300); // 5 minutes

    res.json(response);
  } catch (err) {
    console.error("Menu error:", err);
    res.status(500).json({ message: "Failed to load menu" });
  }
};
