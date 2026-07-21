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
