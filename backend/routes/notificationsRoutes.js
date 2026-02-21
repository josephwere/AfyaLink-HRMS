import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  index,
  list,
  markRead,
  markAllRead,
  markUnread,
} from "../controllers/notificationsController.js";
const router = express.Router();

router.get("/", protect, index);
router.get("/list", protect, list);
router.put("/:id/read", protect, markRead);
router.put("/:id/unread", protect, markUnread);
router.put("/read-all", protect, markAllRead);

export default router;
