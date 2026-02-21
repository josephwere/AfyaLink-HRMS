import Transaction from '../models/Transaction.js';
import User from "../models/User.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import mongoose from 'mongoose';

function getHospitalMatch(req) {
  const hospital = req.user?.hospital;
  if (!hospital) return {};
  return { $or: [{ hospital }, { "meta.hospital": hospital }, { "meta.hospitalId": hospital }] };
}

/**
 * Revenue aggregation: total revenue per day (last 30 days)
 */
export async function revenuePerDay(req, res){
  const since = new Date(Date.now() - 30*24*3600*1000);
  const hospitalMatch = getHospitalMatch(req);
  const pipeline = [
    { $match: { status: 'succeeded', createdAt: { $gte: since }, ...hospitalMatch } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
    { $sort: { '_id': 1 } }
  ];
  const rows = await Transaction.aggregate(pipeline).allowDiskUse(true);
  res.json(rows);
}

/**
 * Doctor utilization: count appointments per doctor in last 30 days, top 10
 * Assumes an 'Appointment' model with fields doctor, status, date
 */
export async function doctorUtilization(req, res){
  const Appointment = mongoose.modelNames().includes('Appointment') ? mongoose.model('Appointment') : null;
  if(!Appointment) return res.json({ error: 'Appointment model not found' });
  const since = new Date(Date.now() - 30*24*3600*1000);
  const hospital = req.user?.hospital;
  const rows = await Appointment.aggregate([
    { $match: { ...(hospital ? { hospital } : {}), scheduledAt: { $gte: since }, status: { $in: ['Completed'] } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctor' } },
    { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
    { $project: { count: 1, doctor: { name: '$doctor.name', _id: '$doctor._id' } } }
  ]).allowDiskUse(true);
  res.json(rows);
}

/**
 * Pharmacy profit: sum(amount - cost) per medicine (requires meta.cost)
 */
export async function pharmacyProfit(req, res){
  const hospitalMatch = getHospitalMatch(req);
  const pipeline = [
    { $match: { provider: 'pharmacy', status: 'succeeded', ...hospitalMatch } },
    { $project: { medicineId: '$meta.medicineId', revenue: '$amount', cost: '$meta.cost' } },
    { $group: { _id: '$medicineId', revenue: { $sum: '$revenue' }, cost: { $sum: '$cost' } } },
    { $addFields: { profit: { $subtract: ['$revenue', '$cost'] } } },
    { $sort: { profit: -1 } }
  ];
  const rows = await Transaction.aggregate(pipeline).allowDiskUse(true);
  res.json(rows);
}

export async function nlpAnalyticsQuery(req, res) {
  try {
    const q = String(req.body?.query || "").toLowerCase();
    const hospital = req.user?.hospital || req.user?.hospitalId || null;
    const hospitalMatch = hospital
      ? { $or: [{ hospital }, { "meta.hospital": hospital }, { "meta.hospitalId": hospital }] }
      : {};

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [revenue30d, staffCount, pendingLeave, pendingOvertime, pendingShift] =
      await Promise.all([
        Transaction.aggregate([
          { $match: { status: "succeeded", createdAt: { $gte: since30d }, ...hospitalMatch } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        User.countDocuments({
          ...(hospital ? { hospital } : {}),
          active: { $ne: false },
          role: { $nin: ["PATIENT", "GUEST"] },
        }),
        LeaveRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
        OvertimeRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
        ShiftRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
      ]);

    const payload = {
      revenue30d: revenue30d?.[0]?.total || 0,
      staffCount,
      pendingApprovals: {
        leave: pendingLeave,
        overtime: pendingOvertime,
        shifts: pendingShift,
        total: pendingLeave + pendingOvertime + pendingShift,
      },
    };

    let interpretation = "Query not recognized. Try 'revenue', 'staff', or 'approvals'.";
    if (q.includes("revenue")) {
      interpretation = `Total succeeded revenue in the last 30 days is ${payload.revenue30d}.`;
    } else if (q.includes("staff")) {
      interpretation = `Active staff count is ${payload.staffCount}.`;
    } else if (q.includes("approval") || q.includes("leave") || q.includes("overtime") || q.includes("shift")) {
      interpretation = `Pending approvals total ${payload.pendingApprovals.total} (leave ${payload.pendingApprovals.leave}, overtime ${payload.pendingApprovals.overtime}, shifts ${payload.pendingApprovals.shifts}).`;
    }

    return res.json({
      ok: true,
      query: req.body?.query || "",
      interpretation,
      metrics: payload,
      suggestedFollowUps: [
        "Show daily revenue trend for the last 30 days",
        "List departments with highest overtime pressure",
        "Compare pending approvals week-over-week",
      ],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export default { revenuePerDay, doctorUtilization, pharmacyProfit, nlpAnalyticsQuery };
