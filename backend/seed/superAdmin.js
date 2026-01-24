import bcrypt from "bcryptjs";
import User from "../models/User.js";

const seedSuperAdmin = async () => {
  try {
    const exists = await User.findOne({ role: "SUPER_ADMIN" });

    if (exists) {
      console.log("ℹ️ Super Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      process.env.SUPER_ADMIN_PASSWORD,
      12
    );

    await User.create({
      name: "System Super Admin",
      email: process.env.SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      verificationRemindersSent: [],
      active: true,
    });

    console.log("✅ Super Admin seeded successfully");
  } catch (err) {
    console.error("❌ Super Admin seed failed:", err);
  }
};

export default seedSuperAdmin; // ✅ default export
