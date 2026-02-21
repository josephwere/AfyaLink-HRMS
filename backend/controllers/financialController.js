import Financial from "../models/Financial.js";
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import AuditLog from "../models/AuditLog.js";

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

export const createInvoice = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const invoiceNumber =
      "INV-" + (req.body.invoiceNumber || uuidv4().slice(0, 8)).toUpperCase();
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const f = await Financial.create({
      ...req.body,
      hospital,
      invoiceNumber,
      total,
      status: "Pending",
    });

    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "CREATE_INVOICE",
      resource: "Financial",
      resourceId: f._id,
      hospital,
      success: true,
      metadata: { invoiceNumber: f.invoiceNumber, total: f.total },
    });

    try {
      getIO().to(String(f.patient)).emit("invoiceCreated", f);
    } catch (_e) {}

    return res.json(f);
  } catch (err) {
    return next(err);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const { id } = req.params;
    const { amount, method, reference } = req.body;

    const f = await Financial.findOne({ _id: id, hospital });
    if (!f) return res.status(404).json({ message: "Invoice not found" });

    f.metadata = f.metadata || {};
    f.metadata.payments = f.metadata.payments || [];
    f.metadata.payments.push({
      amount: Number(amount) || 0,
      method,
      reference,
      at: new Date(),
      by: req.user?._id,
    });

    const paid = f.metadata.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (paid >= (Number(f.total) || 0)) f.status = "Paid";
    await f.save();

    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "RECORD_PAYMENT",
      resource: "Financial",
      resourceId: f._id,
      hospital,
      success: true,
      metadata: { paid, amount: Number(amount) || 0, method, reference },
    });

    try {
      getIO().to(String(f.patient)).emit("paymentRecorded", { invoiceId: f._id, paid });
    } catch (_e) {}

    return res.json(f);
  } catch (err) {
    return next(err);
  }
};

export const submitInsuranceClaim = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const { id } = req.params;
    const f = await Financial.findOne({ _id: id, hospital });
    if (!f) return res.status(404).json({ message: "Invoice not found" });

    const claimId = "CLM-" + uuidv4().slice(0, 8).toUpperCase();
    f.insuranceClaim = {
      provider: f.insuranceClaim?.provider || req.body.provider || "Unknown",
      claimId,
      status: "Submitted",
      submittedAt: new Date(),
    };
    await f.save();

    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "SUBMIT_INSURANCE_CLAIM",
      resource: "Financial",
      resourceId: f._id,
      hospital,
      success: true,
      metadata: { claimId, provider: f.insuranceClaim.provider },
    });

    try {
      getIO().to(String(f.hospital)).emit("insuranceSubmitted", { invoiceId: f._id, claimId });
    } catch (_e) {}
    return res.json({ message: "Claim submitted", claimId, invoice: f });
  } catch (err) {
    return next(err);
  }
};

export const reconcile = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const invoices = await Financial.find({ hospital }).limit(2000).lean();
    const summary = invoices.reduce(
      (acc, inv) => {
        acc.totalInvoices += 1;
        acc.totalAmount += Number(inv.total) || 0;
        if (inv.status === "Paid") acc.paidAmount += Number(inv.total) || 0;
        if (inv.status === "Pending") acc.pendingInvoices += 1;
        return acc;
      },
      { totalInvoices: 0, totalAmount: 0, paidAmount: 0, pendingInvoices: 0 }
    );

    return res.json({ summary, count: invoices.length });
  } catch (err) {
    return next(err);
  }
};

export const listInvoices = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const q = (req.query.q || "").trim();
    const status = req.query.status;

    const filter = { hospital };
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: "i" } },
        { "insuranceClaim.claimId": { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Financial.find(filter)
        .populate("hospital patient")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Financial.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};
