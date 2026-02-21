import Encounter from "../models/Encounter.js";
import User from "../models/User.js";
import { normalizeRole } from "../utils/normalizeRole.js";

/**
 * GET /api/kpis/hospital
 * Admin hospital KPI dashboard
 */
export const hospitalKPIs = async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (!["HOSPITAL_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ message: "Admin only" });
    }

    const totalPatients = await User.countDocuments({ role: "PATIENT" });
    const totalDoctors = await User.countDocuments({ role: "DOCTOR" });
    const totalEncounters = await Encounter.countDocuments();

    res.json({
      totalPatients,
      totalDoctors,
      totalEncounters,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch hospital KPIs" });
  }
};
