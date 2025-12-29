import cron from "node-cron";
import { cleanupUnverifiedUsers } from "./workers/verificationCleanup.js";
import { sendVerificationReminders } from "./workers/verificationReminders.js";

cron.schedule("0 * * * *", async () => {
  await sendVerificationReminders();
});

cron.schedule("0 0 * * *", async () => {
  await cleanupUnverifiedUsers();
});
