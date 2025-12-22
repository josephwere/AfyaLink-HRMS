export const permit = (...allowed) => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) return res.status(401).json({ message: 'Not authorized' });
    if (allowed.includes(user.role)) return next();
    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  };
};
