import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  registerHospitalAdmin,
  getHospitals,
  registerSystemAdmin,
  registerSuperAssistant,
  registerDeveloper,
  listHospitalAdmins,
  updateHospitalAdmin,
  listSuperAssistants,
  updateSuperAssistant,
  sendSuperAssistantResetLink,
  bulkUpdateSuperAssistants,
} from "../controllers/superAdmin.js";

const router = express.Router();

router.use(protect);

router.post(
  "/register-hospital-admin",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  registerHospitalAdmin
);
router.post(
  "/register-super-assistant",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  registerSuperAssistant
);
router.post(
  "/register-system-admin",
  requireRole("SUPER_ADMIN"),
  registerSystemAdmin
);
router.post(
  "/register-developer",
  requireRole("SUPER_ADMIN"),
  registerDeveloper
);
router.get("/hospitals", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"), getHospitals);
router.get(
  "/hospital-admins",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  listHospitalAdmins
);
router.patch(
  "/hospital-admins/:id",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  updateHospitalAdmin
);
router.get(
  "/super-assistants",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  listSuperAssistants
);
router.patch(
  "/super-assistants/:id",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  updateSuperAssistant
);
router.post(
  "/super-assistants/bulk-actions",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  bulkUpdateSuperAssistants
);
router.post(
  "/super-assistants/:id/send-reset-link",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  sendSuperAssistantResetLink
);

export default router;
