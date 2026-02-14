import bcrypt from "bcryptjs";
import User from "../models/User.js";

const seedSuperAdmin = async () => {
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
      console.log("ℹ️ SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD not set. Skipping seed.");
      return;
    }

    const existingByRole = await User.findOne({ role: "SUPER_ADMIN" });
    if (existingByRole) {
      console.log("ℹ️ Super Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: "System Super Admin",
          password: hashedPassword,
          role: "SUPER_ADMIN",
          emailVerified: true,
          emailVerifiedAt: new Date(),
          verificationRemindersSent: [],
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    console.log("✅ Super Admin seeded successfully");
  } catch (err) {
    console.error("❌ Super Admin seed failed:", err);
  }
};

export default seedSuperAdmin; // ✅ default export
