import cron from "node-cron";
import Hospital from "./models/Hospital.js";
import { cleanupUnverifiedUsers } from "./workers/verificationCleanup.js";
import { sendVerificationReminders } from "./workers/verificationReminders.js";
import { dispatchHospitalBillingNotifications } from "./services/hospitalBillingNotifications.js";

cron.schedule("0 * * * *", async () => {
  await sendVerificationReminders();
});

cron.schedule("0 0 * * *", async () => {
  await cleanupUnverifiedUsers();
});

cron.schedule("0 0 * * *", async () => {
  try {
    const hospitals = await Hospital.find({
      active: true,
      $or: [{ "billing.monthlyTarget": { $gt: 0 } }, { "billing.balanceOutstanding": { $gt: 0 } }],
    }).lean();

    await dispatchHospitalBillingNotifications({ hospitals, now: new Date() });
  } catch (err) {
    console.error("Billing notification cron failed", err);
  }
});

// work item escalation (runs every 15 minutes)
import runWorkItemEscalation from "./workers/workItemEscalation.js";
cron.schedule("*/15 * * * *", async () => {
  try {
    await runWorkItemEscalation(new Date());
  } catch (err) {
    console.error("Work item escalation cron failed", err);
  }
});
