import express from "express";
import Transaction from "../models/Transaction.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { transactionSummary } from "../controllers/transactionsController.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { recordExportEvent } from "../utils/exportAudit.js";
import { abacGuard } from "../middleware/abacGuard.js";

const router = express.Router();

function resolveHospital(req) {
  const role = normalizeRole(req.user?.role || "");
  if (
    req.query?.hospitalId &&
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)
  ) {
    return req.query.hospitalId;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

router.use(protect);
router.use(
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "PAYROLL_OFFICER",
    "DEVELOPER"
  )
);
router.use(
  abacGuard({
    domain: "FINANCE",
    resource: "transaction_export",
    action: "read",
    fallbackAllow: true,
  })
);

router.get("/", async (req, res) => {
  try {
    const {
      provider,
      status,
      min,
      max,
      start,
      end,
      search,
      skip = 0,
      limit = 100,
      exportCsv,
    } = req.query;

    const safeSkip = Math.min(Math.max(Number(skip) || 0, 0), 100000);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), exportCsv === "1" ? 2000 : 500);

    const q = {};
    const hospital = resolveHospital(req);
    if (hospital) q.hospital = hospital;

    if (provider) q.provider = provider;
    if (status) q.status = status;
    if (min || max) {
      q.amount = {};
      if (min) q.amount.$gte = Number(min);
      if (max) q.amount.$lte = Number(max);
    }
    if (start || end) {
      q.createdAt = {};
      if (start) q.createdAt.$gte = new Date(start);
      if (end) q.createdAt.$lte = new Date(end);
    }
    if (exportCsv === "1" && !start && !end) {
      q.createdAt = {
        $gte: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        $lte: new Date(),
      };
    }
    if (exportCsv === "1" && q.createdAt?.$gte && q.createdAt?.$lte) {
      const rangeMs = q.createdAt.$lte.getTime() - q.createdAt.$gte.getTime();
      const maxRangeMs = 93 * 24 * 60 * 60 * 1000;
      if (rangeMs > maxRangeMs) {
        return res.status(400).json({ error: "Export date range too large (max 93 days)." });
      }
    }
    if (search) {
      const safeSearch = String(search).slice(0, 80);
      q.$or = [
        { reference: new RegExp(safeSearch, "i") },
        { "meta.patientName": new RegExp(safeSearch, "i") },
      ];
    }

    const rows = await Transaction.find(q)
      .sort({ createdAt: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean();

    if (exportCsv === "1") {
      await recordExportEvent({
        req,
        action: "EXPORT_TRANSACTIONS_CSV",
        resource: "Transaction",
        format: "CSV",
        rowCount: rows.length,
        metadata: {
          provider: provider || null,
          status: status || null,
          start: q.createdAt?.$gte || null,
          end: q.createdAt?.$lte || null,
          hospital: q.hospital || null,
        },
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="transactions_${Date.now()}.csv"`
      );
      res.write("date,provider,status,amount,patient,reference\n");
      for (const r of rows) {
        const line = `${new Date(r.createdAt).toISOString()},${r.provider || ""},${
          r.status || ""
        },${r.amount || 0},${r.meta?.patientName || ""},${r.reference || ""}\n`;
        res.write(line);
      }
      return res.end();
    }

    return res.json({ data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/summary", transactionSummary);

export default router;
