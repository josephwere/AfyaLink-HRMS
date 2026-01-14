export const isoEnforcer = (rule) => {
  return (req, res, next) => {
    const hospital = req.hospital;

    if (!hospital?.isoCompliance?.enabled) {
      return next();
    }

    if (
      hospital.isoCompliance.requireDualApprovalFor.includes(rule) &&
      !req.approvalVerified
    ) {
      return res.status(403).json({
        message: "ISO compliance requires dual approval",
      });
    }

    next();
  };
};
