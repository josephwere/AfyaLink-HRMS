export const getVerificationWarning = (user) => {
  // Already verified → no warning
  if (user.emailVerified || user.phoneVerified) return null;

  // Safety: no deadline set yet
  if (!user.verificationDeadline) {
    return {
      type: "14d",
      message:
        "Kindly verify your account. Your profile may be deleted if not verified.",
    };
  }

  const now = new Date();
  const msLeft = new Date(user.verificationDeadline).getTime() - now.getTime();

  // Expired
  if (msLeft <= 0) {
    return {
      type: "EXPIRED",
      message:
        "Your account has expired due to non-verification and will be removed.",
    };
  }

  const hoursLeft = msLeft / (1000 * 60 * 60);

  if (hoursLeft <= 2) {
    return {
      type: "2h",
      message:
        "Kindly verify your account. Your profile will be deleted in 2 hours.",
    };
  }

  if (hoursLeft <= 72) {
    return {
      type: "3d",
      message:
        "Kindly verify your account. Your profile will be deleted in 3 days.",
    };
  }

  if (hoursLeft <= 336) {
    return {
      type: "14d",
      message:
        "Kindly verify your account. Your profile will be deleted in 14 days.",
    };
  }

  return null;
};
