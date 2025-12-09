// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authenticate user via JWT token in Authorization header
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    req.user = user; // attach user object to request
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

/**
 * Role-based authorization
 * @param {Array} allowedRoles - list of roles allowed to access this route
 */
export const authorize = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden - insufficient role' });
  }
  next();
};
