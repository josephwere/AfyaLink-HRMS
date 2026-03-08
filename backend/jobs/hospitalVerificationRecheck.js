import cron from "node-cron";
import Hospital from "../models/Hospital.js";
import Branch from "../models/Branch.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

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
      await Notification.insertMany(
        admins.map((row) => ({
          title: "Hospital Verification Expired",
          body: `${hospital.name} can no longer operate on AfyaLink until verification is renewed.`,
          category: "PHARMACY",
          user: row._id,
          hospital: hospital._id,
          meta: {
            type: "HOSPITAL_VERIFICATION_EXPIRED",
            path: "/super-admin/hospitals",
          },
        }))
      );
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

