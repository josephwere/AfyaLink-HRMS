import Appointment from '../models/Appointment.js';
import { predictNextAvailableSlot, simpleRiskScore } from '../utils/aiUtils.js';

export const suggestSlot = async (req, res, next) => {
  try {
    const { hospital, doctor, date } = req.query;
    const day = date ? new Date(date) : new Date();
    const appointments = await Appointment.find({ hospital, doctor, scheduledAt: { $gte: new Date(day.setHours(0,0,0,0)), $lt: new Date(new Date(day).setDate(day.getDate()+1)) } });
    const slot = predictNextAvailableSlot(appointments, date ? new Date(date) : new Date());
    res.json({ suggested: slot });
  } catch (err) { next(err); }
};

export const patientRisk = async (req, res, next) => {
  try {
    const patient = req.body;
    const score = simpleRiskScore(patient);
    res.json({ score });
  } catch (err) { next(err); }
};
