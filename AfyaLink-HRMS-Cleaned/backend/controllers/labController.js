import LabTest from "../models/LabTest.js";
import { io } from "../server.js";

// Get all lab tests (Hospital Admin / LabTech)
export const getLabTests = async (req, res) => {
  try {
    const labTests = await LabTest.find().populate("patient requestedBy completedBy");
    res.json(labTests);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Get lab tests assigned to LabTech
export const getAssignedLabTests = async (req,res) => {
  try {
    const labTests = await LabTest.find({ assignedTo: req.user._id }).populate("patient requestedBy completedBy");
    res.json(labTests);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Create lab test request
export const createLabTest = async (req,res) => {
  try {
    const labTest = await LabTest.create(req.body);
    io.emit("notification", { message: "New lab test requested!" });
    res.status(201).json(labTest);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Update lab test (e.g., add results)
export const updateLabTest = async (req,res) => {
  try {
    const labTest = await LabTest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit("notification", { message: "Lab test updated!" });
    res.json(labTest);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Delete lab test
export const deleteLabTest = async (req,res) => {
  try {
    await LabTest.findByIdAndDelete(req.params.id);
    io.emit("notification", { message: "Lab test deleted!" });
    res.json({ message: "Deleted" });
  } catch(err) { res.status(500).json({ message: err.message }); }
};
