import Transaction from '../models/Transaction.js';
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

export async function listTransactions(req, res){
  try{
    const { provider, status, skip=0, limit=50 } = req.query;
    const q = {};
    const hospital = resolveHospital(req);
    if (hospital) q.hospital = hospital;
    if(provider) q.provider = provider;
    if(status) q.status = status;
    const rows = await Transaction.find(q).sort({createdAt:-1}).skip(Number(skip)).limit(Number(limit)).lean();
    res.json({ data: rows });
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
}

export async function transactionSummary(req, res){
  try{
    const hospital = resolveHospital(req);
    const match = { status: "succeeded" };
    if (hospital) match.hospital = hospital;
    const pipeline = [
      { $match: match },
      { $group: { _id: '$provider', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ];
    const rows = await Transaction.aggregate(pipeline).allowDiskUse(true);
    res.json({ data: rows });
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
}
