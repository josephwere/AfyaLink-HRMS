import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';

export async function listTransactions(req, res){
  try{
    const { provider, status, skip=0, limit=50 } = req.query;
    const q = {};
    if(provider) q.provider = provider;
    if(status) q.status = status;
    const rows = await Transaction.find(q).sort({createdAt:-1}).skip(Number(skip)).limit(Number(limit)).lean();
    res.json({ data: rows });
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
}

export async function transactionSummary(req, res){
  try{
    const pipeline = [
      { $match: { status: 'succeeded' } },
      { $group: { _id: '$provider', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ];
    const rows = await Transaction.aggregate(pipeline).allowDiskUse(true);
    res.json({ data: rows });
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
}
