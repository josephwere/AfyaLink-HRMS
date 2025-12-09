const Appointment = require('../models/Appointment');

// GET /api/appointments
exports.list = async (req, res) => {
  try {
    const appointments = await Appointment.find().populate('patient doctor');
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ msg: 'Error fetching appointments' });
  }
};

// POST /api/appointments
exports.create = async (req, res) => {
  try {
    const a = new Appointment(req.body);
    await a.save();
    res.json(a);

    // Notify via Socket.io
    const io = req.app.get('io');
    io.emit('notification', {
      type: 'Appointment',
      message: 'New appointment created'
    });

  } catch (err) {
    res.status(500).json({ msg: 'Error creating appointment' });
  }
};

// PUT /api/appointments/:id
exports.update = async (req, res) => {
  try {
    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: 'Error updating appointment' });
  }
};
