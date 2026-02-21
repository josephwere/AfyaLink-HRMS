import Encounter from "../models/Encounter.js";
import AuditLog from "../models/AuditLog.js";
import { normalizeRole } from "../utils/normalizeRole.js";

export const encounterReadGuard = async (req, res, next) => {
  try {
    const encounterId = req.params.encounterId;
    if (!encounterId) {
      return res.status(400).json({ message: "Encounter id required" });
    }

    const encounter = await Encounter.findById(encounterId)
      .select("hospital patient doctor")
      .lean();
    if (!encounter) {
      return res.status(404).json({ message: "Encounter not found" });
    }

    const role = normalizeRole(req.user?.role || "");
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const userHospital = String(req.user?.hospital || req.user?.hospitalId || "");
    const encounterHospital = String(encounter.hospital || "");

    if (!privileged && userHospital && encounterHospital && userHospital !== encounterHospital) {
      await AuditLog.create({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "ACCESS_DENIED",
        resource: "Encounter",
        resourceId: encounterId,
        hospital: req.user?.hospital || req.user?.hospitalId,
        success: false,
        error: "Cross-hospital encounter read blocked",
      });
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    req.encounter = encounter;
    return next();
  } catch (err) {
    return res.status(500).json({ message: "Encounter access check failed" });
  }
};

