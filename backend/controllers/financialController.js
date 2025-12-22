import Financial from '../models/Financial.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../utils/socket.js';

// create invoice, update totals and emit notifications
export const createInvoice = async (req, res, next) => {
  try {
    const invoiceNumber = 'INV-' + (req.body.invoiceNumber || uuidv4().slice(0,8)).toUpperCase();
    const items = req.body.items || [];
    const total = items.reduce((s,i)=>s+(i.amount||0),0);
    const f = await Financial.create({...req.body, invoiceNumber, total, status: 'Pending'});
    // notify patient and hospital admins
    try { getIO().to(String(f.patient)).emit('invoiceCreated', f); } catch(e){}
    res.json(f);
  } catch (err) { next(err); }
};

// record a payment (partial or full)
export const recordPayment = async (req, res, next) => {
  try {
    const { id } = req.params; // financial id
    const { amount, method, reference } = req.body;
    const f = await Financial.findById(id);
    if (!f) return res.status(404).json({ message: 'Invoice not found' });
    f.metadata = f.metadata || {};
    f.metadata.payments = f.metadata.payments || [];
    f.metadata.payments.push({ amount, method, reference, at: new Date(), by: req.user._id });
    const paid = (f.metadata.payments || []).reduce((s,p)=>s+(p.amount||0),0);
    if (paid >= f.total) f.status = 'Paid';
    await f.save();
    try { getIO().to(String(f.patient)).emit('paymentRecorded', {invoiceId: f._id, paid}); } catch(e){}
    res.json(f);
  } catch (err) { next(err); }
};

// submit insurance claim (simulated integration)
export const submitInsuranceClaim = async (req, res, next) => {
  try {
    const { id } = req.params; // financial id
    const f = await Financial.findById(id);
    if (!f) return res.status(404).json({ message: 'Invoice not found' });
    // simulate claim submission to insurer API
    const claimId = 'CLM-' + uuidv4().slice(0,8).toUpperCase();
    f.insuranceClaim = { provider: f.insuranceClaim?.provider || req.body.provider || 'Unknown', claimId, status: 'Submitted', submittedAt: new Date() };
    await f.save();
    try { getIO().to(String(f.hospital)).emit('insuranceSubmitted', {invoiceId: f._id, claimId}); } catch(e){}
    res.json({ message: 'Claim submitted', claimId, invoice: f });
  } catch (err) { next(err); }
};

// reconcile invoices summary
export const reconcile = async (req, res, next) => {
  try {
    const hospital = req.query.hospital;
    const invoices = await Financial.find(hospital ? { hospital } : {}).limit(1000);
    const summary = invoices.reduce((acc,inv)=>{
      acc.totalInvoices = (acc.totalInvoices||0) + 1;
      acc.totalAmount = (acc.totalAmount||0) + (inv.total||0);
      acc.paid = (acc.paid||0) + ((inv.status==='Paid')?(inv.total||0):0);
      return acc;
    },{});
    res.json({ summary, count: invoices.length });
  } catch (err) { next(err); }
};

export const listInvoices = async (req, res, next) => {
  try {
    const items = await Financial.find().populate('hospital patient').limit(500);
    res.json(items);
  } catch (err) { next(err); }
};
