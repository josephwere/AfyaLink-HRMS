import express from 'express';
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { revenuePerDay, doctorUtilization, pharmacyProfit, nlpAnalyticsQuery } from '../controllers/analyticsController.js';
import { abacGuard } from "../middleware/abacGuard.js";
const router = express.Router();

const analyticsAbac = abacGuard({
  domain: "ANALYTICS",
  resource: "dashboard_insights",
  action: "read",
  fallbackAllow: true,
});

router.get('/revenue/daily', protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR"), analyticsAbac, revenuePerDay);
router.get('/doctors/utilization', protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HR_MANAGER", "DOCTOR"), analyticsAbac, doctorUtilization);
router.get('/pharmacy/profit', protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "PAYROLL_OFFICER", "PHARMACIST"), analyticsAbac, pharmacyProfit);
router.post('/nlp/query', protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR", "DEVELOPER"), analyticsAbac, nlpAnalyticsQuery);

export default router;
