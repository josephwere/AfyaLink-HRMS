import express from 'express';
import { listDLQ, getDLQItem, editAndRetry, retryDLQItem, updateDLQItem, updateRetryPolicy } from '../controllers/dlqController.js';
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"));

router.get('/', listDLQ);
router.get('/:id', getDLQItem);
router.put('/:id', updateDLQItem);
router.post('/:id/retry', retryDLQItem);
router.post('/:id/edit-retry', editAndRetry);
router.post('/connector/:connectorId/retry-policy', updateRetryPolicy);

export default router;
