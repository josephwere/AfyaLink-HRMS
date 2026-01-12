import EmergencyState from "../models/EmergencyState.js";

export const activateEmergency = async (req, res) => {
  const { reason } = req.body;

  const state = await EmergencyState.findOneAndUpdate(
    { hospital: req.user.hospital },
    {
      active: true,
      reason,
      activatedBy: req.user._id,
      activatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  res.json({
    message: "Emergency mode activated",
    state,
  });
};

export const deactivateEmergency = async (req, res) => {
  const state = await EmergencyState.findOneAndUpdate(
    { hospital: req.user.hospital },
    { active: false },
    { new: true }
  );

  res.json({
    message: "Emergency mode lifted",
    state,
  });
};
