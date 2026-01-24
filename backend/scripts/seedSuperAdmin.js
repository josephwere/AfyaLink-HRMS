// backend/scripts/seedSuperAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = process.env.SUPER_ADMIN_EMAIL || "josephogwe8@gmail.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "Josboy@254";

    if (!email || !password) {
      throw new Error("❌ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD missing in .env");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Upsert: create if doesn't exist, update password if exists
    const superAdmin = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: "Joseph Ogwe Were",
          password: hashedPassword,
          role: "SUPER_ADMIN",
          emailVerified: true,
          emailVerifiedAt: new Date(),
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    console.log("✅ Super Admin ready:", superAdmin.email);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to seed Super Admin:", err);
    process.exit(1);
  }
};

run();
