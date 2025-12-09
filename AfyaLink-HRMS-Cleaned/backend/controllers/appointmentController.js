// controllers/appointmentController.js
const Appointment = require("../models/Appointment");

// Get IO instance without circular import
const getIO = () => {
  const { io } = require("../serverInstance");
  return io;
};

// =============================
// Get ALL appointments (Admin)
// =============================
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patient")
      .populate("doctor");

    res.json(appointments);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =======================================
// Get LOGGED-IN user's appointments
// (Doctor or Patient)
// =======================================
exports.getMyAppointments = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "doctor") filter = { doctor: req.user._id };
    if (req.user.role === "patient") filter = { patient: req.user._id };

    const appointments = await Appointment.find(filter)
      .populate("patient")
      .populate("doctor");

    res.json(appointments);
  } catch (err) {
    console.error("Error fetching user appointments:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =============================
// Create Appointment
// =============================
exports.createAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.create(req.body);

    // 🔥 Real-time notification
    getIO().emit("notification", {
      type: "appointment",
      title: "New Appointment",
      message: "A new appointment has been created.",
      createdAt: new Date(),
    });

    res.status(201).json(appointment);
  } catch (err) {
    console.error("Error creating appointment:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =============================
// Update Appointment
// =============================
exports.updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // 🔥 Real-time notification
    getIO().emit("notification", {
      type: "appointment",
      title: "Appointment Updated",
      message: `Appointment ${req.params.id} has been updated.`,
      createdAt: new Date(),
    });

    res.json(appointment);
  } catch (err) {
    console.error("Error updating appointment:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =============================
// Delete Appointment
// =============================
exports.deleteAppointment = async (req, res) => {
  try {
    const deleted = await Appointment.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Appointment not found" });

    // 🔥 Real-time notification
    getIO().emit("notification", {
      type: "appointment",
      title: "Appointment Deleted",
      message: `Appointment ${req.params.id} was deleted.`,
      createdAt: new Date(),
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Error deleting appointment:", err);
    res.status(500).json({ error: "Server error" });
  }
};
