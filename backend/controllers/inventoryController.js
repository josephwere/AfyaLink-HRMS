import PharmacyItem from "../models/PharmacyItem.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function resolveHospital(req) {
  const role = normalizeRole(req.user?.role || "");
  if (
    req.query?.hospitalId &&
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)
  ) {
    return req.query.hospitalId;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

export const index = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) {
      return res.status(400).json({ msg: "Hospital scope required" });
    }

    const total = await PharmacyItem.countDocuments({ hospital });
    res.json({
      module: "inventory",
      status: "ok",
      totalItems: total,
    });
  } catch (err) {
    console.error("Inventory index error:", err);
    res.status(500).json({ msg: "Failed to load inventory summary" });
  }
};

export const list = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) {
      return res.status(400).json({ msg: "Hospital scope required" });
    }

    const q = (req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const filter = { hospital };
    if (q) filter.name = { $regex: q, $options: "i" };

    const [items, total] = await Promise.all([
      PharmacyItem.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PharmacyItem.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Inventory list error:", err);
    res.status(500).json({ msg: "Failed to load inventory" });
  }
};
