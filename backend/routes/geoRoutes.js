import express from "express";
import { geocodeSearch } from "../services/geocodeService.js";

const router = express.Router();

// GET /api/geo/search?q=...
router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const limit = Number(req.query.limit || 5);
    const results = await geocodeSearch({ query, limit });
    return res.json({ count: results.length, results });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Geocode lookup failed" });
  }
});

export default router;
