import cron from "node-cron";
import { expireEmergencies } from "../utils/breakGlass.js";

/* ======================================================
   🚨 Emergency Auto-Expire Job
   - Runs every minute
   - Idempotent
   - Safe in multi-instance environments
====================================================== */
cron.schedule("* * * * *", async () => {
  try {
    const count = await expireEmergencies();

    if (count > 0) {
      console.log(
        `🧯 Emergency cleanup: ${count} emergency session(s) expired`
      );
    }
  } catch (err) {
    console.error("Emergency cleanup failed:", err.message);
  }
});
