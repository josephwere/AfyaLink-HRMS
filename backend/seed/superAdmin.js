import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing in .env");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await User.findOneAndUpdate(
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
      { upsert: true, new: true } // Creates if doesn't exist
    );

    console.log(`✅ Super Admin ready: ${result.email}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Super Admin seed failed:", err);
    process.exit(1);
  }
};

seedSuperAdmin();
