import Patient from '../models/Patient.js';

export const createPatient = async (req, res, next) => {
  try {
    const p = await Patient.create(req.body);
    res.json(p);
  } catch (err) { next(err); }
};

export const getPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const p = await Patient.findById(id).populate('hospital primaryDoctor medicalRecords');
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    res.json(p);
  } catch (err) { next(err); }
};

export const searchPatients = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const patients = await Patient.find({ $or:[
      { firstName: new RegExp(q, 'i') }, { lastName: new RegExp(q, 'i') }, { nationalId: new RegExp(q,'i') }
    ]}).limit(50);
    res.json(patients);
  } catch (err) { next(err); }
};
