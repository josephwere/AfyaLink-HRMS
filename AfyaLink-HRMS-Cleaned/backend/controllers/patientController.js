import Patient from "../models/Patient.js";
import User from "../models/User.js";
import { io } from "../server.js";

// Get all patients (Hospital Admin)
export const getPatients = async (req,res) => {
  try {
    const patients = await Patient.find().populate("user assignedDoctor assignedNurse");
    res.json(patients);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Get assigned patients (Doctor/Nurse)
export const getAssignedPatients = async (req,res) => {
  try {
    const patients = await Patient.find({
      $or: [{ assignedDoctor: req.user._id }, { assignedNurse: req.user._id }]
    }).populate("user assignedDoctor assignedNurse");
    res.json(patients);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Create patient
export const createPatient = async (req,res) => {
  try {
    const { user, assignedDoctor, assignedNurse } = req.body;
    const patient = await Patient.create({ user, assignedDoctor, assignedNurse });
    io.emit("notification", { message: "New patient added!" });
    res.status(201).json(patient);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Update patient
export const updatePatient = async (req,res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit("notification", { message: "Patient updated!" });
    res.json(patient);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Delete patient
export const deletePatient = async (req,res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    io.emit("notification", { message: "Patient deleted!" });
    res.json({ message: "Patient deleted" });
  } catch(err) { res.status(500).json({ message: err.message }); }
};
