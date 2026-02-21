export const detectAnomaly = ({ action, role }) => {
  if (role !== "SUPER_ADMIN") {
    return null;
  }

  const suspicious = [
    "DISABLE_AUDIT_LOGS",
    "DOWNGRADE_PLAN",
    "REMOVE_ADMIN",
  ];

  if (suspicious.includes(action)) {
    return {
      level: "HIGH",
      reason: "Sensitive admin action",
    };
  }

  return null;
};
