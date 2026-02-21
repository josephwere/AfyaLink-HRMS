import Appointment from "../models/Appointment.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function resolveHospital(req) {
  const role = normalizeRole(req.user?.role || "");
  if (
    req.query?.hospitalId &&
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)
  ) {
    return req.query.hospitalId;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

export const index = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) {
      return res.status(400).json({ msg: "Hospital scope required" });
    }

    const [total, scheduled, completed, cancelled] = await Promise.all([
      Appointment.countDocuments({ hospital }),
      Appointment.countDocuments({ hospital, status: "Scheduled" }),
      Appointment.countDocuments({ hospital, status: "Completed" }),
      Appointment.countDocuments({ hospital, status: "Cancelled" }),
    ]);

    res.json({
      module: "appointments_admin",
      status: "ok",
      total,
      scheduled,
      completed,
      cancelled,
    });
  } catch (err) {
    console.error("Appointments admin index error:", err);
    res.status(500).json({ msg: "Failed to load appointment summary" });
  }
};

export const list = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) {
      return res.status(400).json({ msg: "Hospital scope required" });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const status = req.query.status;
    const q = (req.query.q || "").trim();

    const filter = { hospital };
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { reason: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ scheduledAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Appointments admin list error:", err);
    res.status(500).json({ msg: "Failed to load appointments" });
  }
};
