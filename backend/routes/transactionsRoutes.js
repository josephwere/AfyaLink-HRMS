import express from 'express';
import { listTransactions, transactionSummary } from '../controllers/transactionsController.js';
const router = express.Router();
router.get('/', async (req,res)=>{
  try{
    const { provider, status, min, max, start, end, search, skip=0, limit=100, exportCsv } = req.query;
    const q = {};
    if(provider) q.provider = provider;
    if(status) q.status = status;
    if(min || max){ q.amount = {}; if(min) q.amount.$gte = Number(min); if(max) q.amount.$lte = Number(max); }
    if(start || end){ q.createdAt = {}; if(start) q.createdAt.$gte = new Date(start); if(end) q.createdAt.$lte = new Date(end); }
    if(search){ q.$or = [ { reference: new RegExp(search,'i') }, { 'meta.patientName': new RegExp(search,'i') } ]; }
    const rows = await (await import('../models/Transaction.js')).default.find(q).sort({createdAt:-1}).skip(Number(skip)).limit(Number(limit)).lean();
    if(exportCsv === '1'){
      // stream CSV
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
      const header = 'date,provider,status,amount,patient,reference\n';
      res.write(header);
      for(const r of rows){
        const line = `${new Date(r.createdAt).toISOString()},${r.provider},${r.status},${r.amount},${(r.meta?.patientName||'')},${r.reference}\n`;
        res.write(line);
      }
      return res.end();
    }
    res.json({ data: rows });
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
});

router.get('/summary', transactionSummary);
export default router;
