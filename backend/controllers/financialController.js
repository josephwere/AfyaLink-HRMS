import mongoose from "mongoose";
import Financial from "../models/Financial.js";
import Claim from "../models/Claim.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import FraudAlert from "../models/FraudAlert.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import AuditLog from "../models/AuditLog.js";
import { evaluateClaim } from "../services/claimFraudEngine.js";
import { appendClaimAudit } from "../services/claimAuditService.js";
import { decrypt, encrypt } from "../services/cryptoService.js";
import { getRevenueIntelligenceSnapshot } from "../services/revenueIntelligenceService.js";
import { stableStringify, signPayload } from "../utils/claimSignature.js";
import { buildBusinessIdSearchFilter } from "../utils/businessIdSearch.js";
import {
  buildHospitalFinancialIntelligence,
  buildUsageLedgerEntry,
} from "../services/hospitalFinancialIntelligenceService.js";
import { transitionPayment } from "../services/paymentLifecycleService.js";
import { buildReconciliationReport } from "../services/reconciliationService.js";
import JournalEntry from "../models/JournalEntry.js";
import JournalLine from "../models/JournalLine.js";
import ChartOfAccount from "../models/ChartOfAccount.js";
import AccountingPeriod from "../models/AccountingPeriod.js";

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

function resolveRevenueHospital(req) {
  const role = normalizeRole(req.user?.role || "");
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
    return req.query?.hospitalId || null;
  }
  return resolveHospital(req);
}

export const getRevenueIntelligence = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || "");
    const hospitalId = resolveRevenueHospital(req);
    if (!hospitalId && !["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(400).json({ message: "Hospital context required" });
    }

    const snapshot = await getRevenueIntelligenceSnapshot({ hospitalId });
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
};

export const getHospitalFinancialIntelligence = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || "");
    const hospitalId = resolveRevenueHospital(req);
    if (!hospitalId && !["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(400).json({ message: "Hospital context required" });
    }

    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    const invoiceMonth = req.query?.invoiceMonth || null;
    const usageEntries = Array.isArray(req.query?.usageEntries) ? req.query.usageEntries : [];
    const parsedEntries = usageEntries.map((entry) => {
      if (typeof entry === "string") {
        try {
          return JSON.parse(entry);
        } catch (_err) {
          return null;
        }
      }
      return entry;
    }).filter(Boolean);

    const snapshot = await buildHospitalFinancialIntelligence({
      hospital,
      hospitalId: hospitalId || hospital._id,
      invoiceMonth,
      usageEntries: parsedEntries.length ? parsedEntries : null,
      now: new Date(),
    });

    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
};

export const createUsageLedgerEntry = async (req, res, next) => {
  try {
    const hospitalId = resolveHospital(req);
    if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

    const payload = buildUsageLedgerEntry({
      hospitalId,
      serviceCode: req.body?.serviceCode || "CUSTOM",
      serviceName: req.body?.serviceName || "Custom Premium Usage",
      category: req.body?.category || "OTHER",
      quantity: req.body?.quantity || 1,
      unit: req.body?.unit || "unit",
      unitPrice: req.body?.unitPrice || 0,
      currency: req.body?.currency || "KES",
      createdAt: req.body?.createdAt ? new Date(req.body.createdAt) : new Date(),
      metadata: req.body?.metadata || {},
    });

    return res.json(payload);
  } catch (err) {
    return next(err);
  }
};

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

export const listFinanceInvoices = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const query = { hospital };
    if (req.query?.patientId) query.patient = req.query.patientId;
    if (req.query?.status) query.status = req.query.status;

    const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 200);
    const invoices = await Financial.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    return res.json({ items: invoices, invoices, total: invoices.length });
  } catch (err) {
    return next(err);
  }
};

export const getFinanceInvoice = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const invoice = await Financial.findOne({ _id: req.params.id, hospital }).lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    return res.json(invoice);
  } catch (err) {
    return next(err);
  }
};

export const voidFinanceInvoice = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const invoice = await Financial.findOne({ _id: req.params.id, hospital });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    invoice.status = "Cancelled";
    invoice.paymentLifecycleStatus = "VOIDED";
    invoice.lifecycleStatus = "VOIDED";
    await invoice.save();

    return res.json(invoice);
  } catch (err) {
    return next(err);
  }
};

export const listFinancePayments = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const query = { hospitalId: hospital };
    if (req.query?.invoiceId) query.invoiceId = req.query.invoiceId;
    if (req.query?.patientId) {
      const patientInvoices = await Financial.find({ hospital, patient: req.query.patientId }).select("_id").lean();
      query.invoiceId = { $in: patientInvoices.map((doc) => doc._id) };
    }

    const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 200);
    const items = await import("../models/PaymentReceipt.js").then((mod) => mod.default.find(query).sort({ receivedAt: -1 }).limit(limit).lean());

    return res.json({ items, payments: items, total: items.length });
  } catch (err) {
    return next(err);
  }
};

export const getFinancePayment = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const payment = await import("../models/PaymentReceipt.js").then((mod) => mod.default.findOne({ _id: req.params.id, hospitalId: hospital }).lean());
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    return res.json(payment);
  } catch (err) {
    return next(err);
  }
};

export const createFinancePayment = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const { invoiceId, amount, method, reference, metadata = {} } = req.body || {};
    if (!invoiceId) return res.status(400).json({ message: "invoiceId is required" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Amount must be greater than zero" });

    const invoice = await Financial.findOne({ _id: invoiceId, hospital }).lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const receipt = await import("../models/PaymentReceipt.js").then((mod) => mod.default.create({
      hospitalId: hospital,
      invoiceId,
      amount: Number(amount),
      method: method || "CASH",
      reference: reference || `PAY-${Date.now()}`,
      provider: String(method || "CASH").toUpperCase(),
      status: "PROCESSED",
      receivedAt: new Date(),
      metadata: { ...metadata, cashier: req.user?._id || null },
    }));

    const paymentEntries = Array.isArray(invoice.metadata?.payments) ? invoice.metadata.payments : [];
    paymentEntries.push({
      amount: Number(amount),
      method: method || "CASH",
      reference: reference || receipt.reference || receipt._id,
      at: new Date(),
      by: req.user?._id,
    });

    const totalPaid = paymentEntries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const invoiceDoc = await Financial.findById(invoiceId);
    invoiceDoc.metadata = invoiceDoc.metadata || {};
    invoiceDoc.metadata.payments = paymentEntries;
    invoiceDoc.status = Number(totalPaid) >= Number(invoiceDoc.total || 0) ? "Paid" : "Pending";
    invoiceDoc.paymentLifecycleStatus = Number(totalPaid) >= Number(invoiceDoc.total || 0) ? "PAID" : "PARTIALLY_PAID";
    await invoiceDoc.save();

    return res.status(200).json({
      _id: receipt._id,
      invoiceId,
      receiptId: receipt._id,
      amount: Number(amount),
      method: method || "CASH",
      reference: receipt.reference,
      status: invoiceDoc.status,
      payment: { _id: receipt._id, invoiceId, amount: Number(amount), method: method || "CASH" },
      receipt,
    });
  } catch (err) {
    return next(err);
  }
};

export const listFinanceReceipts = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const query = { hospitalId: hospital };
    if (req.query?.paymentId) query._id = req.query.paymentId;
    if (req.query?.patientId) {
      const patientInvoices = await Financial.find({ hospital, patient: req.query.patientId }).select("_id").lean();
      query.invoiceId = { $in: patientInvoices.map((doc) => doc._id) };
    }

    const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 200);
    const items = await import("../models/PaymentReceipt.js").then((mod) => mod.default.find(query).sort({ receivedAt: -1 }).limit(limit).lean());

    return res.json({ items, receipts: items, total: items.length });
  } catch (err) {
    return next(err);
  }
};

export const listAccountingPeriods = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const filter = {};
    if (req.query?.status) filter.status = req.query.status;

    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    const items = await AccountingPeriod.find(filter).sort({ startDate: -1 }).limit(limit).lean();
    return res.json({ items, periods: items, total: items.length });
  } catch (err) {
    return next(err);
  }
};

export const getAccountingPeriod = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const item = await AccountingPeriod.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: "Accounting period not found" });

    return res.json(item);
  } catch (err) {
    return next(err);
  }
};

export const listChartOfAccounts = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const filter = {};
    if (req.query?.segment) filter.category = req.query.segment;
    if (req.query?.status) filter.status = req.query.status;

    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 500);
    const items = await ChartOfAccount.find(filter).sort({ code: 1 }).limit(limit).lean();
    return res.json({ items, accounts: items, total: items.length });
  } catch (err) {
    return next(err);
  }
};

export const getChartOfAccount = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const item = await ChartOfAccount.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: "Account not found" });

    return res.json(item);
  } catch (err) {
    return next(err);
  }
};

export const getGeneralLedger = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    let entries = await JournalEntry.find({ hospitalId: hospital }).sort({ postedAt: -1 }).limit(limit).lean();

    if (req.query?.accountId) {
      const lines = await JournalLine.find({ accountCode: req.query.accountId }).select("journalEntryId").lean();
      const ids = [...new Set(lines.map((line) => String(line.journalEntryId)))];
      entries = entries.filter((entry) => ids.includes(String(entry._id)));
    }

    const items = entries.map((entry) => ({
      ...entry,
      lines: []
    }));

    if (items.length) {
      const entryIds = items.map((entry) => entry._id);
      const lines = await JournalLine.find({ journalEntryId: { $in: entryIds } }).sort({ createdAt: 1 }).lean();
      const group = new Map();
      for (const line of lines) {
        const key = String(line.journalEntryId);
        const bucket = group.get(key) || [];
        bucket.push(line);
        group.set(key, bucket);
      }
      for (const item of items) {
        item.lines = group.get(String(item._id)) || [];
      }
    }

    return res.json({ items, entries: items, total: items.length });
  } catch (err) {
    return next(err);
  }
};

export const getJournalEntries = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    let entries = await JournalEntry.find({ hospitalId: hospital }).sort({ postedAt: -1 }).limit(limit).lean();

    if (req.query?.accountId) {
      const lines = await JournalLine.find({ accountCode: req.query.accountId }).select("journalEntryId").lean();
      const ids = [...new Set(lines.map((line) => String(line.journalEntryId)))];
      entries = entries.filter((entry) => ids.includes(String(entry._id)));
    }

    return res.json({ items: entries, entries, total: entries.length });
  } catch (err) {
    return next(err);
  }
};

export const getFinanceReconciliation = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const report = await buildReconciliationReport({ hospitalId: hospital });
    return res.json(report);
  } catch (err) {
    return next(err);
  }
};

export const getFinanceReceipt = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const receipt = await import("../models/PaymentReceipt.js").then((mod) => mod.default.findOne({ _id: req.params.id, hospitalId: hospital }).lean());
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });

    return res.json(receipt);
  } catch (err) {
    return next(err);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const id = String(req.params.id || "").trim();
    const { amount, method, reference } = req.body;
    const invoiceQuery = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { invoiceId: id }] }
      : { invoiceId: id };

    const f = await Financial.findOne({ ...invoiceQuery, hospital });
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
    if (paid >= (Number(f.total) || 0)) {
      f.status = "Paid";
      await transitionPayment({
        invoiceId: f._id,
        eventName: "InvoicePaid",
        status: "PAID",
        payload: { amount: paid, total: Number(f.total) || 0 },
      });
    } else {
      await transitionPayment({
        invoiceId: f._id,
        eventName: "InvoicePartiallyPaid",
        status: "PARTIALLY_PAID",
        payload: { amount: paid, total: Number(f.total) || 0 },
      });
    }
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

    const hospitalDoc = await Hospital.findById(hospital);
    if (!hospitalDoc) return res.status(404).json({ message: "Hospital not found" });
    const patient = await Patient.findById(f.patient).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    if (String(patient.hospital) !== String(hospitalDoc._id)) {
      return res.status(403).json({ message: "Patient is not linked to this hospital" });
    }

    const claimId = "CLM-" + uuidv4().slice(0, 8).toUpperCase();
    const provider = f.insuranceClaim?.provider || req.body.provider || "Unknown";

    const items = Array.isArray(req.body?.procedures)
      ? req.body.procedures
      : (f.items || []).map((item, index) => ({
          code: String(item?.code || `ITEM_${index + 1}`).trim().toUpperCase(),
          name: String(item?.description || `Item ${index + 1}`).trim(),
          category: String(item?.category || "BILLING_ITEM").trim().toUpperCase(),
          quantity: Number(item?.quantity || 1),
          amount: Number(item?.amount || 0),
          performedAt: item?.performedAt ? new Date(item.performedAt) : f.createdAt,
        }));

    const now = new Date();
    const safeDate = (value, fallback) => {
      if (!value) return fallback;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };
    const servicePeriod = req.body?.servicePeriod || f.metadata?.servicePeriod || {};
    const normalizedServicePeriod = {
      start: safeDate(servicePeriod?.start, f.createdAt || now),
      end: safeDate(servicePeriod?.end, safeDate(servicePeriod?.start, f.createdAt || now)),
    };

    const payloadForSignature = {
      hospitalId: hospitalDoc._id,
      patientId: patient._id,
      provider: { code: provider },
      country: req.body?.country || hospitalDoc?.location?.country || "",
      currency: req.body?.currency || "KES",
      totalAmount: Number(f.total || 0),
      servicePeriod: normalizedServicePeriod,
      procedures: items,
    };

    const requireSignature =
      hospitalDoc?.claimsSecurity?.requireSignature !== false &&
      process.env.CLAIM_SIGNATURE_REQUIRED !== "0";

    let signatureValue = "";
    let signatureKeyId = hospitalDoc?.claimsSecurity?.keyId || "";
    if (requireSignature) {
      const masterKey = process.env.CLAIM_SECRET_KEY;
      if (!masterKey) {
        return res.status(500).json({ message: "CLAIM_SECRET_KEY not configured" });
      }
      let rawSecret = "";
      if (!hospitalDoc?.claimsSecurity?.hmacSecretEnc) {
        rawSecret = crypto.randomBytes(32).toString("hex");
        hospitalDoc.claimsSecurity = hospitalDoc.claimsSecurity || {};
        hospitalDoc.claimsSecurity.hmacSecretEnc = encrypt(rawSecret, masterKey);
        hospitalDoc.claimsSecurity.keyId = uuidv4();
        hospitalDoc.claimsSecurity.lastRotatedAt = new Date();
        hospitalDoc.claimsSecurity.requireSignature = true;
        signatureKeyId = hospitalDoc.claimsSecurity.keyId;
        await hospitalDoc.save();
      } else {
        rawSecret = decrypt(hospitalDoc.claimsSecurity.hmacSecretEnc, masterKey);
      }
      const payload = stableStringify(payloadForSignature);
      signatureValue = signPayload({ secret: rawSecret, payload });
    }

    const claim = new Claim({
      hospital: hospitalDoc._id,
      patient: patient._id,
      encounter: req.body?.encounterId || null,
      provider: { code: provider, name: req.body?.providerName || "", country: req.body?.country || hospitalDoc?.location?.country || "" },
      country: req.body?.country || hospitalDoc?.location?.country || "",
      currency: req.body?.currency || "KES",
      totalAmount: Number(f.total || 0),
      servicePeriod: normalizedServicePeriod,
      procedures: items,
      submissionChannel: "SYSTEM",
      submittedBy: req.user?._id || null,
      signature: {
        algorithm: "HMAC-SHA256",
        value: signatureValue,
        keyId: signatureKeyId,
        signedAt: new Date(),
      },
      patientSnapshot: {
        nationalId: patient.nationalId || "",
        countryId: patient.countryId || "",
        dob: patient.dob || null,
        gender: patient.gender || "",
        registryMatch: null,
        identityStatus: patient?.identityVerification?.status || "",
      },
      hospitalSnapshot: {
        name: hospitalDoc.name || "",
        registrationNumber: hospitalDoc?.verification?.registrationNumber || "",
        verificationStatus: hospitalDoc?.verification?.status || "",
      },
    });

    const evaluation = await evaluateClaim({ claim, hospital: hospitalDoc.toObject(), patient });
    claim.riskScore = evaluation.riskScore;
    claim.riskSignals = evaluation.signals;
    claim.riskFlags = [...new Set(evaluation.signals.map((s) => s.code))];
    claim.duplicateGroup = evaluation.duplicateGroupSeed || "";
    if (evaluation.duplicateOf) claim.duplicateOf = evaluation.duplicateOf;
    if (evaluation.statusOverride) claim.status = evaluation.statusOverride;
    if (evaluation.registryMatch !== undefined) {
      claim.patientSnapshot.registryMatch = evaluation.registryMatch;
      const method = patient?.nationalId ? "NATIONAL_ID" : patient?.countryId ? "HEALTH_ID" : "";
      await Patient.updateOne(
        { _id: patient._id },
        {
          $set: {
            "identityVerification.registryMatch": evaluation.registryMatch,
            "identityVerification.lastCheckedAt": now,
            "identityVerification.method": method,
          },
        }
      );
      if (evaluation.registryMatch) {
        await Patient.updateOne(
          { _id: patient._id },
          {
            $set: {
              "identityVerification.status": "VERIFIED",
              "identityVerification.verifiedAt": now,
              "identityVerification.immutable": true,
            },
          }
        );
        claim.patientSnapshot.identityStatus = "VERIFIED";
      } else {
        await Patient.updateOne(
          { _id: patient._id, "identityVerification.status": { $ne: "VERIFIED" } },
          { $set: { "identityVerification.status": "UNVERIFIED" } }
        );
        claim.patientSnapshot.identityStatus = patient?.identityVerification?.status || "UNVERIFIED";
      }
    }

    await claim.save();

    if (evaluation.signals.length > 0) {
      const severity = evaluation.signals.some((s) => s.severity === "HIGH")
        ? "HIGH"
        : evaluation.signals.some((s) => s.severity === "MEDIUM")
          ? "MEDIUM"
          : "LOW";
      await FraudAlert.create({
        claim: claim._id,
        hospital: hospitalDoc._id,
        patient: patient._id,
        severity,
        signals: evaluation.signals.map((s) => s.code),
      });
    }

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_SUBMITTED",
      payload: {
        status: claim.status,
        riskScore: claim.riskScore,
        riskFlags: claim.riskFlags,
      },
      actorId: req.user?._id,
    });

    f.insuranceClaim = {
      provider,
      claimId,
      status: claim.status || "Submitted",
      claimRef: claim._id,
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
    return res.json({ message: "Claim submitted", claimId, invoice: f, claim });
  } catch (err) {
    return next(err);
  }
};

export const reconcile = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const report = await buildReconciliationReport({ hospitalId: hospital });
    return res.json(report);
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
      filter.$or = buildBusinessIdSearchFilter(q, ["invoiceId"], [
        { invoiceNumber: { $regex: q, $options: "i" } },
        { "insuranceClaim.claimId": { $regex: q, $options: "i" } },
      ]).$or;
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
