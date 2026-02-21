import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getDelegationScope,
  getUserDelegatedPermissions,
  upsertUserDelegatedPermissions,
  removeDelegatedPermission,
} from "../controllers/delegatedPermissionController.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"));

router.get("/scope", getDelegationScope);
router.get("/:userId", getUserDelegatedPermissions);
router.put("/:userId", upsertUserDelegatedPermissions);
router.delete("/:userId", removeDelegatedPermission);

export default router;

