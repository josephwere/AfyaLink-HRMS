import User from "../models/User.js";

/**
 * Cleanup unverified users whose verification deadline has passed.
 * Safe-guarded to prevent accidental mass deletion.
 */
export const cleanupUnverifiedUsers = async () => {
  try {
    const now = new Date();

    const result = await User.deleteMany({
      emailVerified: false,
      verificationDeadline: { $exists: true, $lt: now },
    });

    if (result.deletedCount > 0) {
      console.log(
        `🧹 Verification cleanup: deleted ${result.deletedCount} unverified user(s)`
      );
    }
  } catch (err) {
    console.error("❌ Verification cleanup failed:", err);
  }
};
