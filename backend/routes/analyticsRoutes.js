import express from 'express';
import { revenuePerDay, doctorUtilization, pharmacyProfit } from '../controllers/analyticsController.js';
const router = express.Router();

router.get('/revenue/daily', revenuePerDay);
router.get('/doctors/utilization', doctorUtilization);
router.get('/pharmacy/profit', pharmacyProfit);

export default router;
