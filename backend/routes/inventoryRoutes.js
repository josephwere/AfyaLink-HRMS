import express from "express";
import { index, list } from "../controllers/inventoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
const router = express.Router();

router.get("/", protect, authorize("inventory", "read"), index);
router.get("/list", protect, authorize("inventory", "read"), list);

export default router;
