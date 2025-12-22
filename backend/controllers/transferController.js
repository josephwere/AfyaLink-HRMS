import Transfer from '../models/Transfer.js';
import Patient from '../models/Patient.js';
import { getIO } from '../utils/socket.js';

export const requestTransfer = async (req, res, next) => {
  try {
    const payload = {...req.body, requestedBy: req.user._id, status: 'Pending'};
    const t = await Transfer.create(payload);
    t.audit = [{ by: req.user._id, action: 'requested', at: new Date(), note: req.body.reasons || '' }];
    await t.save();
    try { getIO().to(String(t.toHospital)).emit('transferRequested', t); } catch(e){}
    res.json(t);
  } catch (err) { next(err); }
};

export const approveTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const t = await Transfer.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    t.status = 'Approved';
    t.approvedBy = req.user._id;
    t.audit.push({ by: req.user._id, action: 'approved', at: new Date() });
    await t.save();
    // optionally move patient record (soft-link)
    const patient = await Patient.findById(t.patient);
    if (patient) {
      patient.metadata = patient.metadata || {};
      patient.metadata.transferHistory = patient.metadata.transferHistory || [];
      patient.metadata.transferHistory.push({ from: t.fromHospital, to: t.toHospital, at: new Date(), by: req.user._id });
      await patient.save();
    }
    try { getIO().to(String(t.requestedBy)).emit('transferApproved', t); } catch(e){}
    res.json(t);
  } catch (err) { next(err); }
};

export const rejectTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const t = await Transfer.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    t.status = 'Rejected';
    t.audit.push({ by: req.user._id, action: 'rejected', at: new Date(), note: reason || '' });
    await t.save();
    try { getIO().to(String(t.requestedBy)).emit('transferRejected', t); } catch(e){}
    res.json(t);
  } catch (err) { next(err); }
};

export const completeTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const t = await Transfer.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    t.status = 'Completed';
    t.audit.push({ by: req.user._id, action: 'completed', at: new Date() });
    await t.save();
    try { getIO().to(String(t.toHospital)).emit('transferCompleted', t); } catch(e){}
    res.json(t);
  } catch (err) { next(err); }
};
