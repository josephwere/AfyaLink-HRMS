import express from "express";
import { approveExternalAccess } from "../controllers/externalAccessController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

/* HOSPITAL ADMIN / SUPER ADMIN ONLY */
router.post(
  "/approve",
  protect,
  authorize("HOSPITAL_ADMIN", "SUPER_ADMIN"),
  approveExternalAccess
);

export default router;
