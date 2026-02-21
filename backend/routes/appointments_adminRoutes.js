import express from "express";
import { index, list } from "../controllers/appointments_adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
const router = express.Router();

router.get("/", protect, authorize("appointments", "read"), index);
router.get("/list", protect, authorize("appointments", "read"), list);

export default router;
