import { normalizeRole } from "../utils/normalizeRole.js";
import {
  getClinicalOrderCopilotSnapshot,
  getDigitalHospitalTwinSnapshot,
  getInteropMarketplaceSnapshot,
} from "../services/platformInnovationService.js";

function resolveScopedHospital(req) {
  const role = normalizeRole(req.user?.role || "");
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
    return req.query?.hospitalId || null;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

export async function getClinicalOrderCopilot(req, res, next) {
  try {
    const role = normalizeRole(req.user?.role || "");
    const hospitalId = resolveScopedHospital(req);
    const clinicianId = ["DOCTOR", "SURGEON"].includes(role) ? req.user?._id || req.user?.id || null : null;
    const snapshot = await getClinicalOrderCopilotSnapshot({ hospitalId, clinicianId });
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
}

export async function getDigitalHospitalTwin(req, res, next) {
  try {
    const hospitalId = resolveScopedHospital(req);
    const snapshot = await getDigitalHospitalTwinSnapshot({ hospitalId });
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
}

export async function getInteropMarketplace(req, res, next) {
  try {
    const hospitalId = resolveScopedHospital(req);
    const snapshot = await getInteropMarketplaceSnapshot({ hospitalId });
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
}
