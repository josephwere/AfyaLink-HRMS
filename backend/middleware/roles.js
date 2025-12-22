/* ======================================================
   ROLE-BASED ACCESS CONTROL
====================================================== */
export const allowRoles = (...roles) => {
  const allowed = roles.map(r => r.toLowerCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowed.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};
