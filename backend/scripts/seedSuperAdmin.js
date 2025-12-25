import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = "josephogwe8@gmail.com";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("❌ Super Admin already exists");
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(
    process.env.SUPERADMIN_PASSWORD,
    12
  );

  const superAdmin = await User.create({
    name: "Joseph Ogwe Were",
    email,
    password: hashedPassword,
    role: "superadmin",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  });

  console.log("✅ Super Admin created:", superAdmin.email);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
