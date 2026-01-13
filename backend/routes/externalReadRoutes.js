import express from "express";
import SecurityIncident from "../models/SecurityIncident.js";
import { externalAccessGuard } from "../middleware/externalAccessGuard.js";

const router = express.Router();

router.get(
  "/incidents",
  externalAccessGuard("INCIDENTS"),
  async (req, res) => {
    const incidents = await SecurityIncident.find({
      hospital: req.externalAccess.hospital,
    }).sort({ createdAt: -1 });

    res.json({ count: incidents.length, incidents });
  }
);

export default router;
