import Notification from '../models/Notification.js';
export const createNotification = async (req, res, next) => {
  try {
    const n = await Notification.create(req.body);
    res.json(n);
  } catch (err) { next(err); }
};
export const listNotifications = async (req, res, next) => {
  try {
    const items = await Notification.find({ user: req.user._id }).limit(200);
    res.json(items);
  } catch (err) { next(err); }
};
