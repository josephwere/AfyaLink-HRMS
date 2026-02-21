import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { index, list, create, update, remove } from "../controllers/branchesController.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"));

router.get("/", index);
router.get("/list", list);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
