/**
 * pharmacyForecast.js
 * Simple forecasting utilities for pharmacy stock prediction.
 * Uses historical sales (transactions) collection to compute moving averages and month-over-month seasonality.
 *
 * Exports:
 *  - predictMedicationDemand(medicineId, lookbackDays=90, horizonDays=30)
 *
 * This is intentionally simple and transparent: production teams can replace with ML models later.
 */

import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';

function avg(arr){ if(!arr || !arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }

export async function predictMedicationDemand(medicineId, lookbackDays = 90, horizonDays = 30){
  // We expect Transaction collection to have entries for pharmacy sales with meta.medicineId and meta.quantity
  const since = new Date(Date.now() - lookbackDays * 24*3600*1000);
  const pipeline = [
    { $match: { 'meta.medicineId': mongoose.Types.ObjectId.isValid(medicineId) ? mongoose.Types.ObjectId(medicineId) : medicineId, 'createdAt': { $gte: since }, 'provider': 'pharmacy', 'status': 'succeeded' } },
    { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }, totalQty: { $sum: '$meta.quantity' } } },
    { $sort: { '_id.day': 1 } }
  ];
  const rows = await Transaction.aggregate(pipeline).allowDiskUse(true);
  if(!rows || rows.length === 0) return { predicted: 0, history: [], method: 'no-data' };
  const daily = rows.map(r => r.totalQty);
  const movingAvg = avg(daily.slice(-7)); // last week avg
  const monthlyAvg = avg(daily) * 30; // rough
  // simple projection: horizonDays * movingAvg
  const predicted = Math.round(movingAvg * horizonDays);
  return { predicted, method: 'movingAvg7', movingAvg, monthlyAvg, historyCount: daily.length };
}

export default { predictMedicationDemand };
