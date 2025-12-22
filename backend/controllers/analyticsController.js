import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';

/**
 * Revenue aggregation: total revenue per day (last 30 days)
 */
export async function revenuePerDay(req, res){
  const since = new Date(Date.now() - 30*24*3600*1000);
  const pipeline = [
    { $match: { status: 'succeeded', createdAt: { $gte: since } } },
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
  const rows = await Appointment.aggregate([
    { $match: { date: { $gte: since }, status: { $in: ['completed','done'] } } },
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
  const pipeline = [
    { $match: { provider: 'pharmacy', status: 'succeeded' } },
    { $project: { medicineId: '$meta.medicineId', revenue: '$amount', cost: '$meta.cost' } },
    { $group: { _id: '$medicineId', revenue: { $sum: '$revenue' }, cost: { $sum: '$cost' }, profit: { $sum: { $subtract: ['$amount', '$meta.cost'] } } } },
    { $sort: { profit: -1 } }
  ];
  const rows = await Transaction.aggregate(pipeline).allowDiskUse(true);
  res.json(rows);
}

export default { revenuePerDay, doctorUtilization, pharmacyProfit };
