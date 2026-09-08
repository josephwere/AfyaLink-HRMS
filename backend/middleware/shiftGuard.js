import CashierShift from "../models/CashierShift.js";

// Prevent attaching payments to shifts that are closed/locked/under review
export default async function shiftGuard(req, res, next) {
  try {
    const body = req.body || {};
    const metadata = body.metadata || {};
    const shiftId = body.shiftId || metadata.shiftId || (metadata && metadata.shiftId) || null;
    if (!shiftId) return next();

    const shift = await CashierShift.findById(shiftId).lean();
    if (!shift) return res.status(400).json({ ok: false, error: "Invalid shift" });

    // Only allow payments when shift is OPEN or IN_PROGRESS or REOPENED
    const allowed = new Set(["OPEN", "IN_PROGRESS", "REOPENED"]);
    if (!allowed.has(String(shift.status || "").toUpperCase())) {
      return res.status(400).json({ ok: false, error: "Payments are not allowed against a closed or under-review shift" });
    }

    return next();
  } catch (err) {
    console.error("shiftGuard error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Shift guard failed" });
  }
}
