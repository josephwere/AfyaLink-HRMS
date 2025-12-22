import User from '../models/User.js';

export const getMe = async (req, res, next) => {
  try {
    res.json(req.user);
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').limit(500);
    res.json(users);
  } catch (err) { next(err); }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (updates.password) delete updates.password; // password change via separate endpoint
    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { next(err); }
};
