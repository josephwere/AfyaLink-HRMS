import Encounter from "../models/Encounter.js";
import User from "../models/User.js";

/**
 * GET /api/kpis/hospital
 * Admin hospital KPI dashboard
 */
export const hospitalKPIs = async (req, res) => {
  try {
    const totalPatients = await User.countDocuments({ role: "patient" });
    const totalDoctors = await User.countDocuments({ role: "doctor" });
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
