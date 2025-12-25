import User from "../models/User.js";

export const cleanupUnverifiedUsers = async () => {
  const now = new Date();

  await User.deleteMany({
    emailVerified: false,
    verificationDeadline: { $lt: now },
  });
};
