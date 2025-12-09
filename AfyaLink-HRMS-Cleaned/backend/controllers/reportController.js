import Report from "../models/Report.js";
import { io } from "../server.js";

// Get all reports (Hospital Admin)
export const getReports = async (req,res) => {
  try {
    const reports = await Report.find().populate("patient createdBy");
    res.json(reports);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Get own reports (Doctor / Patient)
export const getMyReports = async (req,res) => {
  try {
    let filter = {};
    if(req.user.role === "doctor") filter = { createdBy: req.user._id };
    if(req.user.role === "patient") filter = { patient: req.user._id };
    const reports = await Report.find(filter).populate("patient createdBy");
    res.json(reports);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Create report
export const createReport = async (req,res) => {
  try {
    const report = await Report.create(req.body);
    io.emit("notification", { message: "New report created!" });
    res.status(201).json(report);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Update report
export const updateReport = async (req,res) => {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit("notification", { message: "Report updated!" });
    res.json(report);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Delete report
export const deleteReport = async (req,res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    io.emit("notification", { message: "Report deleted!" });
    res.json({ message: "Deleted" });
  } catch(err) { res.status(500).json({ message: err.message }); }
};
