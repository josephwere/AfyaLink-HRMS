import express from "express";
import SecurityIncident from "../models/SecurityIncident.js";
import { externalAccessGuard } from "../middleware/externalAccessGuard.js";

const router = express.Router();

router.get(
  "/incidents",
  externalAccessGuard("INCIDENTS"),
  async (req, res) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const skip = (page - 1) * limit;
    const filter = {
      hospital: req.externalAccess.hospital,
    };

    const [incidents, total] = await Promise.all([
      SecurityIncident.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SecurityIncident.countDocuments(filter),
    ]);
    res.json({ count: incidents.length, total, page, limit, incidents });
  }
);

export default router;
