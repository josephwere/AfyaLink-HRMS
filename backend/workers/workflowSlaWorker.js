import cron from "node-cron";
import { checkWorkflowSLA } from "../services/workflowSlaService.js";

cron.schedule("*/5 * * * *", async () => {
  try {
    await checkWorkflowSLA();
  } catch (err) {
    console.error("SLA worker failed:", err.message);
  }
});
