import cron from "node-cron";
import ExternalAccessGrant from "../models/ExternalAccessGrant.js";

/* ======================================================
   SECURITY CRON JOBS
   Runs every 10 minutes
====================================================== */

cron.schedule("*/10 * * * *", async () => {
  try {
    const now = new Date();

    /* ================================
       AUTO-REVOKE EXTERNAL ACCESS
       (Police / Government)
    ================================= */
    const result = await ExternalAccessGrant.updateMany(
      {
        expiresAt: { $lt: now },
        revoked: false,
      },
      { revoked: true }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[SECURITY CRON] Revoked ${result.modifiedCount} expired external access grants`
      );
    }
  } catch (error) {
    console.error("[SECURITY CRON ERROR]", error.message);
  }
});
