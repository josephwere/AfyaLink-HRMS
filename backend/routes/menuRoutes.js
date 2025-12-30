import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getMenu } from "../controllers/menuController.js";

const router = express.Router();

/* ======================================================
   🧭 DYNAMIC MENU (ROLE + FEATURE + HOSPITAL AWARE)
====================================================== */

router.get("/", protect, getMenu);

export default router;
