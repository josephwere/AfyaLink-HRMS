import express from 'express';
import {
  listTransfers,
  requestTransfer,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  getTransferConsent,
  grantTransferConsent,
  revokeTransferConsent,
  exportTransferFHIR,
  exportTransferHL7,
  verifyTransferProvenance,
  transferAuditTrail,
} from "../controllers/transferController.js";
import { protect } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/roleMiddleware.js';
import { requireTransferConsent } from "../middleware/consentGuard.js";
import { abacGuard } from "../middleware/abacGuard.js";
import { normalizeRole } from "../utils/normalizeRole.js";
const router = express.Router();

function attachTransferAbacContext({ requiredScopes = [] } = {}) {
  return (req, _res, next) => {
    const transfer = req.transfer;
    if (!transfer) return next();
    const role = normalizeRole(req.user?.role || "");
    const userHospital = String(req.user?.hospital || req.user?.hospitalId || "");
    const fromHospital = String(transfer.fromHospital || "");
    const toHospital = String(transfer.toHospital || "");
    const isPrivileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const sameHospital = userHospital && [fromHospital, toHospital].includes(userHospital);
    const sourceHospitalBypass = userHospital && userHospital === fromHospital;
    const allowedScopes = Array.isArray(req.transferConsent?.scopes)
      ? req.transferConsent.scopes.map((s) => String(s).toLowerCase())
      : [];

    req.resource = {
      ...(req.resource || {}),
      hospitalIds: [fromHospital, toHospital].filter(Boolean),
      sameHospital: Boolean(sameHospital),
      sourceHospitalBypass: Boolean(sourceHospitalBypass),
      hasActiveConsent: Boolean(req.transferConsent) || Boolean(isPrivileged),
      allowedScopes,
      requiredScopes: requiredScopes.map((s) => String(s).toLowerCase()),
    };
    return next();
  };
}

router.get("/", protect, permit("DOCTOR", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listTransfers);
router.post('/', protect, permit('DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'), requestTransfer);
router.post('/:id/approve', protect, permit('HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'), approveTransfer);
router.post('/:id/reject', protect, permit('HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'), rejectTransfer);
router.post('/:id/complete', protect, permit('HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'), completeTransfer);
router.get(
  "/:id/consent",
  protect,
  permit("DOCTOR", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  requireTransferConsent({ writeBypass: true }),
  getTransferConsent
);
router.post("/:id/consent/grant", protect, permit("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"), grantTransferConsent);
router.post("/:id/consent/revoke", protect, permit("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"), revokeTransferConsent);
router.get(
  "/:id/fhir",
  protect,
  permit("DOCTOR", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  requireTransferConsent({ writeBypass: true }),
  attachTransferAbacContext({ requiredScopes: ["demographics"] }),
  abacGuard({ domain: "INTEROP", resource: "transfer_export", action: "read", fallbackAllow: true }),
  exportTransferFHIR
);
router.get(
  "/:id/hl7",
  protect,
  permit("DOCTOR", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  requireTransferConsent({ writeBypass: true }),
  attachTransferAbacContext({ requiredScopes: ["encounters"] }),
  abacGuard({ domain: "INTEROP", resource: "transfer_export", action: "read", fallbackAllow: true }),
  exportTransferHL7
);
router.get(
  "/:id/audit",
  protect,
  permit("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  requireTransferConsent({ writeBypass: true }),
  attachTransferAbacContext(),
  abacGuard({ domain: "INTEROP", resource: "transfer_export", action: "read", fallbackAllow: true }),
  transferAuditTrail
);
router.post(
  "/:id/provenance/verify",
  protect,
  permit("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  requireTransferConsent({ writeBypass: true }),
  attachTransferAbacContext(),
  abacGuard({ domain: "INTEROP", resource: "transfer_export", action: "read", fallbackAllow: true }),
  verifyTransferProvenance
);

export default router;
