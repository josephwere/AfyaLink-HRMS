import Transfer from "../models/Transfer.js";
import TransferConsent from "../models/TransferConsent.js";
import AuditLog from "../models/AuditLog.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function resolveHospital(req) {
  return req.user?.hospital || req.user?.hospitalId || null;
}

function canAccessTransfer(user, transfer) {
  const role = normalizeRole(user?.role || "");
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) return true;
  const hospital = String(user?.hospital || user?.hospitalId || "");
  return (
    hospital &&
    (hospital === String(transfer.fromHospital) || hospital === String(transfer.toHospital))
  );
}

function isPrivilegedTransferRole(user) {
  const role = normalizeRole(user?.role || "");
  return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
}

function isActiveConsent(consent) {
  if (!consent || consent.status !== "GRANTED") return false;
  if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) return false;
  return true;
}

export const requireTransferConsent = ({ writeBypass = true } = {}) => {
  return async (req, res, next) => {
    const transfer = await Transfer.findById(req.params.id);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    if (!canAccessTransfer(req.user, transfer)) {
      await AuditLog.create({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "ACCESS_DENIED",
        resource: "Transfer",
        resourceId: transfer._id,
        hospital: resolveHospital(req),
        success: false,
        error: "Cross-hospital access denied",
      });
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    if (isPrivilegedTransferRole(req.user)) {
      req.transfer = transfer;
      req.transferConsent = null;
      return next();
    }

    const userHospital = String(resolveHospital(req) || "");
    const sourceHospital = String(transfer.fromHospital || "");
    if (writeBypass && userHospital && userHospital === sourceHospital) {
      req.transfer = transfer;
      req.transferConsent = null;
      return next();
    }

    const consent = await TransferConsent.findOne({ transfer: transfer._id });
    if (!isActiveConsent(consent)) {
      await AuditLog.create({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "ACCESS_DENIED",
        resource: "TransferConsent",
        resourceId: transfer._id,
        hospital: resolveHospital(req),
        success: false,
        error: "Active patient consent required",
      });
      return res.status(403).json({ message: "Active patient consent required" });
    }

    req.transfer = transfer;
    req.transferConsent = consent;
    return next();
  };
};
