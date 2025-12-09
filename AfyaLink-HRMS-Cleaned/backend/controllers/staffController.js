import Staff from "../models/Staff.js";
import { io } from "../server.js";

// Get all staff (Hospital Admin)
export const getStaff = async (req,res) => {
  try {
    const staff = await Staff.find().populate("user role");
    res.json(staff);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Add staff
export const addStaff = async (req,res) => {
  try {
    const staff = await Staff.create(req.body);
    io.emit("notification", { message: "New staff added!" });
    res.status(201).json(staff);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Update staff
export const updateStaff = async (req,res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit("notification", { message: "Staff updated!" });
    res.json(staff);
  } catch(err) { res.status(500).json({ message: err.message }); }
};

// Delete staff
export const deleteStaff = async (req,res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    io.emit("notification", { message: "Staff deleted!" });
    res.json({ message: "Deleted" });
  } catch(err) { res.status(500).json({ message: err.message }); }
};
