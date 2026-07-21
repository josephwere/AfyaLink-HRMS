import cron from "node-cron";
import Hospital from "../models/Hospital.js";
import Branch from "../models/Branch.js";
import User from "../models/User.js";
import { notifyUsers } from "../services/notificationService.js";

async function expireHospitalVerifications() {
  const now = new Date();
  const hospitals = await Hospital.find({
    "verification.status": "VERIFIED",
    "verification.expiresAt": { $ne: null, $lt: now },
  });

  for (const hospital of hospitals) {
    hospital.verification.status = "EXPIRED";
    hospital.verification.publicVisible = false;
    await hospital.save();

    const admins = await User.find({
      hospital: hospital._id,
      role: { $in: ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"] },
      active: true,
    })
      .select("_id")
      .lean();

    if (admins.length) {
      await notifyUsers({
        users: admins.map((row) => row._id),
        hospital: hospital._id,
        title: "Hospital Verification Expired",
        body: `${hospital.name} can no longer operate on AfyaLink until verification is renewed.`,
        category: "PHARMACY",
        meta: {
          type: "HOSPITAL_VERIFICATION_EXPIRED",
          path: "/super-admin/hospitals",
        },
      });
    }
  }
}

async function expireBranchVerifications() {
  const now = new Date();
  const branches = await Branch.find({
    "verification.status": "VERIFIED",
    "verification.expiresAt": { $ne: null, $lt: now },
  });

  for (const branch of branches) {
    branch.verification.status = "EXPIRED";
    branch.verification.publicVisible = false;
    await branch.save();
  }
}

cron.schedule("15 2 * * *", async () => {
  try {
    await expireHospitalVerifications();
    await expireBranchVerifications();
  } catch (err) {
    console.error("Hospital verification recheck failed:", err.message);
  }
});

