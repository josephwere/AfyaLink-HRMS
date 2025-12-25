export const getVerificationWarning = (user) => {
  if (user.emailVerified) return null;

  const now = new Date();
  const msLeft = user.verificationDeadline - now;

  if (msLeft <= 0) {
    return { type: "EXPIRED" };
  }

  const hoursLeft = msLeft / (1000 * 60 * 60);

  if (hoursLeft <= 2) return { type: "2h" };
  if (hoursLeft <= 72) return { type: "3d" };
  if (hoursLeft <= 336) return { type: "14d" };

  return null;
};
