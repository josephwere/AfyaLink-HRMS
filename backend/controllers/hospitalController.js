import Hospital from '../models/Hospital.js';
import { v4 as uuidv4 } from 'uuid';

export const createHospital = async (req, res, next) => {
  try {
    const { name, address, contact, code } = req.body;
    const hospital = await Hospital.create({ name, address, contact, code: code || ('H-'+uuidv4().slice(0,8)) });
    res.json(hospital);
  } catch (err) { next(err); }
};

export const listHospitals = async (req, res, next) => {
  try {
    const hospitals = await Hospital.find();
    res.json(hospitals);
  } catch (err) { next(err); }
};
