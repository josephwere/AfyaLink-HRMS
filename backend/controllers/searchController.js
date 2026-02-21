import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function isGlobalRole(role) {
  return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
}

export const globalSearch = async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit || 8), 1), 25);
    const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || "");
    const hospitalId = req.user?.hospital || req.user?.hospitalId || null;

    if (!q || q.length < 2) {
      return res.json({ hospitals: [], workers: [] });
    }

    const userFilter = {
      active: true,
      role: { $ne: "GUEST" },
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { nationalIdNumber: { $regex: q, $options: "i" } },
        { "employment.employeeId": { $regex: q, $options: "i" } },
      ],
    };

    if (!isGlobalRole(actorRole)) {
      userFilter.hospital = hospitalId || null;
    } else if (req.query?.hospital) {
      userFilter.hospital = req.query.hospital;
    }

    // Hospital-level roles should not see elevated platform identities in search suggestions.
    if (actorRole === "HOSPITAL_ADMIN") {
      userFilter.role = {
        $nin: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "GUEST"],
      };
    }

    const workersPromise = User.find(userFilter)
      .select("_id name email phone role hospital")
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    let hospitalsPromise = Promise.resolve([]);
    if (isGlobalRole(actorRole)) {
      hospitalsPromise = Hospital.find({
        $or: [
          { name: { $regex: q, $options: "i" } },
          { code: { $regex: q, $options: "i" } },
        ],
      })
        .select("_id name code active")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(limit)
        .lean();
    } else if (hospitalId) {
      hospitalsPromise = Hospital.find({
        _id: hospitalId,
        $or: [
          { name: { $regex: q, $options: "i" } },
          { code: { $regex: q, $options: "i" } },
        ],
      })
        .select("_id name code active")
        .limit(1)
        .lean();
    }

    const [workers, hospitals] = await Promise.all([workersPromise, hospitalsPromise]);
    return res.json({ hospitals, workers });
  } catch (err) {
    console.error("Global search error:", err);
    return res.status(500).json({ message: "Failed to run search" });
  }
};

