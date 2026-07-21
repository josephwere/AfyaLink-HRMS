import Hospital from "../models/Hospital.js";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";
import Notification from "../models/Notification.js";
import { v4 as uuidv4 } from "uuid";
import { cacheDel } from "../utils/cache.js";
import { diffObjects } from "../utils/diff.js";
import { audit } from "../utils/audit.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { encrypt } from "../services/cryptoService.js";
import { serializeHospital } from "../utils/serializers.js";
import { buildBusinessIdSearchFilter } from "../utils/businessIdSearch.js";
import { notify } from "../services/notificationService.js";

const HOSPITAL_DOC_FIELDS = [
  "registrationCertificate",
  "taxRegistration",
  "proofOfAddress",
  "representativeId",
];
const MAX_HOSPITAL_DOC_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOC_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const hospitalUploadsRoot = path.resolve(process.cwd(), "uploads", "hospital-verification");

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const normalizeRegistryText = (value) => String(value || "").trim().toLowerCase();

const coerceBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes"].includes(value.toLowerCase());
  return Boolean(value);
};

const buildHospitalVerificationSummary = (hospital) => ({
  status: hospital?.verification?.status || "UNVERIFIED",
  registrationNumber: hospital?.verification?.registrationNumber || "",
  approvalDate: hospital?.verification?.approvalDate || null,
  verifiedAt: hospital?.verification?.verifiedAt || null,
  expiresAt: hospital?.verification?.expiresAt || null,
  nextReverificationAt: hospital?.verification?.nextReverificationAt || null,
  publicVisible: Boolean(hospital?.verification?.publicVisible),
  badgeLabel: hospital?.verification?.badgeLabel || "Government Approved",
  suspiciousSignals: hospital?.verification?.suspiciousSignals || [],
  registryHospital: hospital?.verification?.registryHospital || null,
});

function isDemoHospitalCandidate(hospital) {
  const name = String(hospital?.name || "").trim().toLowerCase();
  const code = String(hospital?.code || "").trim().toUpperCase();
  const address = String(hospital?.address || "").trim().toLowerCase();
  const knownDemoMarkers = ["nairobi central medical centre", "kiambu regional hospital", "machakos community hospital", "kisumu lakeside hospital", "eldoret highlands medical centre", "demo hospital", "test hospital"];
  return knownDemoMarkers.some((marker) => name.includes(marker) || address.includes(marker) || code.includes(marker.toUpperCase().replace(/\s+/g, "")));
}

async function ensureUploadRoot() {
  await fs.mkdir(hospitalUploadsRoot, { recursive: true });
}

function assessDocumentRisk(file, registrationNumber, hospitalName) {
  const signals = [];
  if (!ALLOWED_DOC_MIME_TYPES.has(file.mimetype)) {
    signals.push("unsupported-format");
  }
  if (file.size > MAX_HOSPITAL_DOC_BYTES) {
    signals.push("oversized-document");
  }
  if (file.size < 20 * 1024) {
    signals.push("document-too-small");
  }

  const name = normalizeRegistryText(file.originalname);
  if (registrationNumber && !name.includes(normalizeRegistryText(registrationNumber).replace(/\s+/g, ""))) {
    signals.push("registration-number-not-in-file-name");
  }
  if (hospitalName) {
    const hospitalSlug = normalizeRegistryText(hospitalName).split(/\s+/).filter(Boolean).slice(0, 2).join("-");
    if (hospitalSlug && !name.includes(hospitalSlug.replace(/\s+/g, "-"))) {
      signals.push("hospital-name-not-in-file-name");
    }
  }

  return {
    validationStatus: signals.length ? "REVIEW_REQUIRED" : "AUTO_VALID",
    signals,
  };
}

async function persistHospitalDocument({ file, hospitalCode, fieldName, registrationNumber, hospitalName }) {
  const folder = path.join(hospitalUploadsRoot, hospitalCode);
  await fs.mkdir(folder, { recursive: true });
  const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const filename = `${fieldName}-${sha256.slice(0, 16)}${ext}`;
  const storagePath = path.join(folder, filename);
  await fs.writeFile(storagePath, file.buffer);

  const risk = assessDocumentRisk(file, registrationNumber, hospitalName);

  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    storagePath,
    uploadedAt: new Date(),
    validationStatus: risk.validationStatus,
    suspiciousSignals: risk.signals,
  };
}

function collectMissingDocumentFields(files = {}) {
  return HOSPITAL_DOC_FIELDS.filter((field) => !files?.[field]?.[0]);
}

async function resolveRegistryHospital({ registryHospitalId, registrationNumber, name, type, country, region, city }) {
  const registrationKey = String(registrationNumber || "").trim();
  const query = registryHospitalId
    ? { _id: registryHospitalId }
    : { registrationNumber: registrationKey };

  const registryHospital = await GovernmentHospitalRegistry.findOne(query).lean();
  if (!registryHospital) {
    return { error: "Registration number is not present in the approved government registry." };
  }

  if (registryHospital.status !== "ACTIVE") {
    return { error: "Government registry entry is not active. Registration is blocked." };
  }

  if (registryHospital.validUntil && new Date(registryHospital.validUntil) < new Date()) {
    return { error: "Government registry license has expired. Registration is blocked." };
  }

  const requestedName = normalizeRegistryText(name);
  const candidateNames = [registryHospital.officialName, ...(registryHospital.aliases || [])]
    .map(normalizeRegistryText)
    .filter(Boolean);
  const nameMatched = !requestedName || candidateNames.some((candidate) => candidate.includes(requestedName) || requestedName.includes(candidate));
  if (!nameMatched) {
    return { error: "Hospital name does not match the government registry entry." };
  }

  if (type && String(type).toUpperCase() !== registryHospital.hospitalType) {
    return { error: "Hospital type does not match the government registry entry." };
  }

  if (country && normalizeRegistryText(country) !== normalizeRegistryText(registryHospital.location?.country)) {
    return { error: "Country does not match the government registry entry." };
  }
  if (region && normalizeRegistryText(region) !== normalizeRegistryText(registryHospital.location?.region)) {
    return { error: "Region does not match the government registry entry." };
  }
  if (city && normalizeRegistryText(city) !== normalizeRegistryText(registryHospital.location?.city)) {
    return { error: "City does not match the government registry entry." };
  }

  return { registryHospital };
}

/* ================= CREATE HOSPITAL ================= */

export const createHospital = async (req, res, next) => {
  try {
    const {
      name,
      address,
      contact,
      type,
      email,
      phone,
      code,
      registrationNumber,
      registryHospitalId,
      country,
      region,
      city,
      lat,
      lng,
      location,
    } = req.body;

    const normalizedName = String(name || "").trim();
    const normalizedType = String(type || "PRIVATE").trim().toUpperCase();
    const normalizedRegistrationNumber = String(registrationNumber || "").trim().toUpperCase();
    const resolvedCountry = String(location?.country || country || "").trim();
    const resolvedRegion = String(location?.region || region || "").trim();
    const resolvedCity = String(location?.city || city || "").trim();
    const missingDocumentFields = collectMissingDocumentFields(req.files || {});

    if (!normalizedName || !normalizedRegistrationNumber || !resolvedCountry || !resolvedRegion || !resolvedCity) {
      return res.status(400).json({
        message: "Name, registration number, country, region, and city are required.",
      });
    }

    if (missingDocumentFields.length) {
      return res.status(400).json({
        message: "All mandatory verification documents must be uploaded.",
        missingDocuments: missingDocumentFields,
      });
    }

    const existingLicense = await Hospital.findOne({
      "verification.registrationNumber": normalizedRegistrationNumber,
    })
      .select("_id name")
      .lean();
    if (existingLicense) {
      return res.status(409).json({
        message: "A hospital with this registration number already exists.",
        existingHospital: { _id: existingLicense._id, name: existingLicense.name },
      });
    }

    const { registryHospital, error } = await resolveRegistryHospital({
      registryHospitalId,
      registrationNumber: normalizedRegistrationNumber,
      name: normalizedName,
      type: normalizedType,
      country: resolvedCountry,
      region: resolvedRegion,
      city: resolvedCity,
    });

    if (error) {
      return res.status(422).json({ message: error, code: "REGISTRY_VERIFICATION_FAILED" });
    }

    const hospitalCode = String(code || `H-${uuidv4().slice(0, 8)}`).trim();
    await ensureUploadRoot();

    const storedDocuments = {};
    const suspiciousSignals = [];
    for (const fieldName of HOSPITAL_DOC_FIELDS) {
      const file = req.files?.[fieldName]?.[0];
      const stored = await persistHospitalDocument({
        file,
        hospitalCode,
        fieldName,
        registrationNumber: normalizedRegistrationNumber,
        hospitalName: normalizedName,
      });
      storedDocuments[fieldName] = stored;
      suspiciousSignals.push(...(stored.suspiciousSignals || []).map((signal) => `${fieldName}:${signal}`));
    }

    const verificationStatus = suspiciousSignals.length ? "REVIEW_REQUIRED" : "VERIFIED";
    const now = new Date();
    const expiryDate = registryHospital.validUntil ? new Date(registryHospital.validUntil) : null;
    const nextReverificationAt = expiryDate || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const hospital = await Hospital.create({
      name: normalizedName,
      address: String(address || registryHospital.location?.address || "").trim(),
      contact: String(contact || phone || email || registryHospital.contact?.phone || registryHospital.contact?.email || "").trim(),
      type: normalizedType,
      code: hospitalCode,
      location: {
        country: resolvedCountry,
        region: resolvedRegion,
        city: resolvedCity,
        lat: toNumberOrNull(location?.lat ?? lat),
        lng: toNumberOrNull(location?.lng ?? lng),
      },
      verification: {
        status: verificationStatus,
        registryHospital: registryHospital._id,
        registrationNumber: normalizedRegistrationNumber,
        approvalDate: verificationStatus === "VERIFIED" ? now : null,
        verifiedAt: verificationStatus === "VERIFIED" ? now : null,
        verifiedBy: verificationStatus === "VERIFIED" ? req.user?._id || null : null,
        expiresAt: expiryDate,
        nextReverificationAt,
        source: registryHospital.source?.name || "GOVERNMENT_REGISTRY",
        badgeLabel: "Government Approved",
        publicVisible: verificationStatus === "VERIFIED",
        lastRegistryCheckAt: now,
        lastRegistryCheckResult: "MATCHED",
        suspiciousSignals,
        reviewNotes:
          verificationStatus === "REVIEW_REQUIRED"
            ? "Automated document validation flagged this registration for manual compliance review."
            : "",
      },
      verificationDocuments: {
        registrationCertificate: storedDocuments.registrationCertificate,
        taxRegistration: storedDocuments.taxRegistration,
        proofOfAddress: storedDocuments.proofOfAddress,
        representativeId: storedDocuments.representativeId,
      },
      securityControls: {
        requireTwoFactorForAdmins: true,
        suspiciousRegistrationScore: suspiciousSignals.length,
      },
      subscription: {
        paid: false,
        status: "TRIAL",
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        premiumPaused: false,
        reminderTagsSent: ["trial_started"],
      },

      /* 🔐 DEFAULT FEATURE FLAGS (ONBOARDING SAFE) */
      features: {
        ai: true,
        payments: true,
        pharmacy: true,
        inventory: true,
        lab: true,
        realtime: true,
        auditLogs: true,
        adminCreation: true,
        advertising: true,
        recruitmentAds: true,
        advancedAnalytics: true,
        heavyExports: true,
      },
    });

    if (req.user?._id) {
      await Promise.all([
        notify({
          title: "Hospital Registration Submitted",
          body:
            verificationStatus === "VERIFIED"
              ? `${hospital.name} is now verified against the government registry.`
              : `${hospital.name} matched the registry but needs manual review before it can go live.`,
          user: req.user._id,
          hospital: hospital._id,
          category: "SYSTEM",
          meta: {
            type: "HOSPITAL_REGISTRATION_STATUS",
            status: verificationStatus,
            registrationNumber: normalizedRegistrationNumber,
          },
        }),
        notify({
          title: "Free Trial Started",
          body: `${hospital.name} has started a 3-month free trial. Premium features are active now.`,
          user: req.user._id,
          hospital: hospital._id,
          category: "SUBSCRIPTION",
          meta: {
            type: "TRIAL_STARTED",
            trialEndsAt: hospital.subscription?.trialEndsAt,
          },
        }),
      ]);
    }

    await audit({
      req,
      action: "CREATE_HOSPITAL",
      resource: "Hospital",
      resourceId: hospital._id,
      metadata: {
        verificationStatus,
        registrationNumber: normalizedRegistrationNumber,
        suspiciousSignals,
      },
    });

    res.status(201).json({
      success: true,
      hospital,
      verification: buildHospitalVerificationSummary(hospital),
    });
  } catch (err) {
    next(err);
  }
};

export const searchGovernmentHospitals = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const country = String(req.query.country || "").trim();
    const region = String(req.query.region || "").trim();
    const city = String(req.query.city || "").trim();
    const filter = { status: "ACTIVE" };

    if (country) filter["location.country"] = { $regex: `^${country}$`, $options: "i" };
    if (region) filter["location.region"] = { $regex: `^${region}$`, $options: "i" };
    if (city) filter["location.city"] = { $regex: `^${city}$`, $options: "i" };
    if (q) {
      filter.$text = { $search: q };
    }

    const rows = await GovernmentHospitalRegistry.find(filter)
      .sort(q ? { score: { $meta: "textScore" }, officialName: 1 } : { officialName: 1 })
      .limit(20)
      .lean();

    res.json({
      items: rows.map((row) => ({
        _id: row._id,
        officialName: row.officialName,
        registrationNumber: row.registrationNumber,
        hospitalType: row.hospitalType,
        location: row.location || {},
        contact: row.contact || {},
        validUntil: row.validUntil || null,
        source: row.source || {},
      })),
    });
  } catch (err) {
    next(err);
  }
};

/* ================= LIST HOSPITALS ================= */

export const listHospitals = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const q = (req.query.q || "").trim();
    const active = req.query.active;
    const verified = req.query.verified;
    const status = String(req.query.status || "").trim().toUpperCase();
    const withoutAdmin = coerceBoolean(req.query.withoutAdmin);

    const filter = {};
    if (q) {
      filter.$or = buildBusinessIdSearchFilter(q, ["hospitalId"], [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { contact: { $regex: q, $options: "i" } },
        { "verification.registrationNumber": { $regex: q, $options: "i" } },
      ]).$or;
    }
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;
    // Support `verified` boolean param and legacy `status=VERIFIED` used by some clients
    if (verified === "true") filter["verification.status"] = "VERIFIED";
    if (verified === "false") {
      filter["verification.status"] = { $ne: "VERIFIED" };
    }
    if (status === "VERIFIED") {
      filter["verification.status"] = "VERIFIED";
    }
    if (withoutAdmin) {
      filter.$and = [...(filter.$and || []), { $or: [{ admins: { $exists: false } }, { admins: { $size: 0 } }] }];
    }

    const [rows, total] = await Promise.all([
      Hospital.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Hospital.countDocuments(filter),
    ]);

    const now = new Date();
    const items = rows.map((h) => {
      const trialEndsAt = h?.subscription?.trialEndsAt ? new Date(h.subscription.trialEndsAt) : null;
      const status = h?.subscription?.status || "TRIAL";
      const paid = status === "ACTIVE";
      const trialExpired = trialEndsAt ? now > trialEndsAt : false;
      const premiumPaused = Boolean(h?.subscription?.premiumPaused) || (trialExpired && !paid);
      const base = {
        ...h,
        verificationSummary: buildHospitalVerificationSummary(h),
        subscriptionState: {
          status,
          trialEndsAt,
          trialExpired,
          premiumPaused,
          daysLeft: trialEndsAt
            ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : 0,
        },
      };
      return serializeHospital(base);
    });

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

/* ================= GET FEATURE TOGGLES ================= */

export const getHospitalFeatures = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .select("name features")
      .lean();

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    res.json(hospital);
  } catch (err) {
    next(err);
  }
};

/* ================= UPDATE FEATURE TOGGLES (SUPER_ADMIN) ================= */

export const updateHospitalFeatures = async (req, res, next) => {
  try {
    const { features } = req.body;

    /* 🔍 BEFORE (FORENSIC SNAPSHOT) */
    const before = await Hospital.findById(req.params.id).lean();
    if (!before) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    /* ✏️ UPDATE */
    const updated = await Hospital.findByIdAndUpdate(
      req.params.id,
      { features },
      { new: true }
    ).lean();

    /* 🧮 DIFF (WHAT ACTUALLY CHANGED) */
    const diff = diffObjects(before.features, updated.features);

    /* 🧹 CLEAR MENU CACHE (ALL USERS IN HOSPITAL) */
    await cacheDel(`menu:*:${updated._id}`);

    /* 🧾 AUDIT (NON-BLOCKING, SAFE) */
    try {
      await audit({
        req,
        action: "UPDATE_HOSPITAL_FEATURES",
        resource: "Hospital",
        resourceId: updated._id,
        metadata: diff,
      });
    } catch (e) {
      console.error("Audit failed (non-blocking):", e.message);
    }

    res.json({
      message: "Hospital features updated",
      changes: diff,
      features: updated.features,
    });
  } catch (err) {
    next(err);
  }
};

/* ================= UPDATE HOSPITAL DETAILS ================= */

export const updateHospital = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      contact,
      type,
      code,
      active,
      plan,
      subscription,
      verification,
      accreditations,
      claimsSecurity,
      country,
      region,
      city,
      lat,
      lng,
      location,
    } = req.body || {};

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    const before = hospital.toObject();

    if (name !== undefined) hospital.name = String(name).trim();
    if (address !== undefined) hospital.address = String(address).trim();
    if (contact !== undefined) hospital.contact = String(contact).trim();
    if (type !== undefined) hospital.type = String(type).trim().toUpperCase();
    if (code !== undefined) hospital.code = String(code).trim();

    if (location || country !== undefined || region !== undefined || city !== undefined || lat !== undefined || lng !== undefined) {
      hospital.location = hospital.location || {};
      if (location?.country !== undefined || country !== undefined) {
        hospital.location.country = String(location?.country ?? country ?? "").trim();
      }
      if (location?.region !== undefined || region !== undefined) {
        hospital.location.region = String(location?.region ?? region ?? "").trim();
      }
      if (location?.city !== undefined || city !== undefined) {
        hospital.location.city = String(location?.city ?? city ?? "").trim();
      }
      if (location?.lat !== undefined || lat !== undefined) {
        hospital.location.lat = toNumberOrNull(location?.lat ?? lat);
      }
      if (location?.lng !== undefined || lng !== undefined) {
        hospital.location.lng = toNumberOrNull(location?.lng ?? lng);
      }
    }
    if (active !== undefined) hospital.active = Boolean(active);
    if (plan !== undefined) hospital.plan = plan;
    if (verification && typeof verification === "object") {
      hospital.verification = hospital.verification || {};
      if (verification.status !== undefined) {
        hospital.verification.status = String(verification.status).trim().toUpperCase();
      }
      if (verification.expiresAt !== undefined) {
        hospital.verification.expiresAt = verification.expiresAt ? new Date(verification.expiresAt) : null;
      }
      if (verification.nextReverificationAt !== undefined) {
        hospital.verification.nextReverificationAt = verification.nextReverificationAt
          ? new Date(verification.nextReverificationAt)
          : null;
      }
      if (verification.reviewNotes !== undefined) {
        hospital.verification.reviewNotes = String(verification.reviewNotes || "").trim();
      }
      if (verification.publicVisible !== undefined) {
        hospital.verification.publicVisible = Boolean(verification.publicVisible);
      }
      if (verification.status === "VERIFIED") {
        hospital.verification.verifiedAt = hospital.verification.verifiedAt || new Date();
        hospital.verification.verifiedBy = req.user?._id || hospital.verification.verifiedBy || null;
        hospital.verification.approvalDate = hospital.verification.approvalDate || new Date();
      }
    }
    if (subscription && typeof subscription === "object") {
      hospital.subscription = hospital.subscription || {};
      if (subscription.status !== undefined) {
        hospital.subscription.status = String(subscription.status).toUpperCase();
      }
      if (subscription.paid !== undefined) {
        hospital.subscription.paid = Boolean(subscription.paid);
      }
      if (subscription.trialEndsAt !== undefined) {
        hospital.subscription.trialEndsAt = subscription.trialEndsAt
          ? new Date(subscription.trialEndsAt)
          : null;
      }
      if (subscription.premiumPaused !== undefined) {
        hospital.subscription.premiumPaused = Boolean(subscription.premiumPaused);
      }
      if (subscription.lastPaymentAt !== undefined) {
        hospital.subscription.lastPaymentAt = subscription.lastPaymentAt
          ? new Date(subscription.lastPaymentAt)
          : null;
      }
      if (subscription.nextBillingAt !== undefined) {
        hospital.subscription.nextBillingAt = subscription.nextBillingAt
          ? new Date(subscription.nextBillingAt)
          : null;
      }

      const now = new Date();
      const trialEndsAt = hospital.subscription?.trialEndsAt
        ? new Date(hospital.subscription.trialEndsAt)
        : null;
      const trialExpired = trialEndsAt ? now > trialEndsAt : false;
      if (hospital.subscription?.paid === true) {
        hospital.subscription.status = "ACTIVE";
        hospital.subscription.premiumPaused = false;
      } else if (trialExpired) {
        hospital.subscription.status = "PAUSED";
        hospital.subscription.premiumPaused = true;
      } else if (hospital.subscription?.status !== "ACTIVE") {
        hospital.subscription.status = "TRIAL";
        hospital.subscription.premiumPaused = false;
      }
    }

    if (Array.isArray(accreditations)) {
      hospital.accreditations = accreditations.map((item) => ({
        code: String(item?.code || "").trim(),
        name: String(item?.name || "").trim(),
        categories: Array.isArray(item?.categories) ? item.categories.map((c) => String(c || "").trim()) : [],
        status: String(item?.status || "ACTIVE").trim().toUpperCase(),
        validFrom: item?.validFrom ? new Date(item.validFrom) : null,
        validTo: item?.validTo ? new Date(item.validTo) : null,
      }));
    }

    if (claimsSecurity && typeof claimsSecurity === "object") {
      hospital.claimsSecurity = hospital.claimsSecurity || {};
      if (claimsSecurity.requireSignature !== undefined) {
        hospital.claimsSecurity.requireSignature = Boolean(claimsSecurity.requireSignature);
      }
    }

    await hospital.save();

    await audit({
      req,
      action: "UPDATE_HOSPITAL",
      resource: "Hospital",
      resourceId: hospital._id,
      metadata: diffObjects(before, hospital.toObject()),
    });

    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

export const rotateHospitalClaimSecret = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }
    const actorHospital = req.user?.hospitalId || req.user?.hospital;
    const actorRole = String(req.user?.role || "").toUpperCase();
    if (["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(actorRole) && String(actorHospital) !== String(hospital._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const masterKey = process.env.CLAIM_SECRET_KEY;
    if (!masterKey) {
      return res.status(500).json({ message: "CLAIM_SECRET_KEY not configured" });
    }

    const rawSecret = crypto.randomBytes(32).toString("hex");
    hospital.claimsSecurity = hospital.claimsSecurity || {};
    hospital.claimsSecurity.hmacSecretEnc = encrypt(rawSecret, masterKey);
    hospital.claimsSecurity.keyId = uuidv4();
    hospital.claimsSecurity.lastRotatedAt = new Date();
    hospital.claimsSecurity.requireSignature = true;
    await hospital.save();

    await audit({
      req,
      action: "ROTATE_HOSPITAL_CLAIM_SECRET",
      resource: "Hospital",
      resourceId: hospital._id,
      metadata: { keyId: hospital.claimsSecurity.keyId },
    });

    return res.json({
      hospitalId: hospital._id,
      keyId: hospital.claimsSecurity.keyId,
      secret: rawSecret,
      note: "Store this secret securely. It will not be shown again.",
    });
  } catch (err) {
    next(err);
  }
};
/* ================= SOFT DELETE (DEACTIVATE HOSPITAL) ================= */
/* NEVER hard-delete hospitals */

export const deactivateHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    if (hospital.active === false) {
      return res.json({ message: "Hospital already deactivated" });
    }

    hospital.active = false;
    await hospital.save();

    /* 🧹 CLEAR MENU CACHE (ALL USERS IN HOSPITAL) */
    await cacheDel(`menu:*:${hospital._id}`);

    /* 🧾 AUDIT */
    await audit({
      req,
      action: "DEACTIVATE_HOSPITAL",
      resource: "Hospital",
      resourceId: hospital._id,
    });

    res.json({ message: "Hospital deactivated successfully" });
  } catch (err) {
    next(err);
  }
};

/* ================= PATIENT MARKETPLACE LIST ================= */
export const listMarketplaceHospitals = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const lat = toNumberOrNull(req.query.lat);
    const lng = toNumberOrNull(req.query.lng);
    const radiusKm = Math.max(Number(req.query.radiusKm || 100), 1);

    const filter = {
      active: true,
    };
    const isDemoMode = String(req.query.demo || "true").toLowerCase() !== "false";
    if (!isDemoMode) {
      filter["verification.status"] = "VERIFIED";
      filter["verification.publicVisible"] = true;
    } else {
      filter.$or = [
        { "verification.status": "VERIFIED" },
        { "verification.publicVisible": true },
        { $expr: { $in: [{ $toLower: "$name" }, ["nairobi central medical centre", "kiambu regional hospital", "machakos community hospital", "kisumu lakeside hospital", "eldoret highlands medical centre", "demo hospital", "test hospital"]] } },
      ];
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { "location.region": { $regex: q, $options: "i" } },
        { "location.city": { $regex: q, $options: "i" } },
      ];
    }

    const enableDistanceSort = lat !== null && lng !== null;

    const rows = await Hospital.find(filter)
        .select("name code address contact type insuranceProviders patientPaymentMethods subscription location verification features customization")
      .sort(enableDistanceSort ? { createdAt: -1 } : { name: 1 })
      .lean();

    const now = new Date();
    const mapped = rows
      .map((h) => {
        const trialEndsAt = h?.subscription?.trialEndsAt ? new Date(h.subscription.trialEndsAt) : null;
        const status = h?.subscription?.status || "TRIAL";
        const paid = status === "ACTIVE";
        const trialExpired = trialEndsAt ? now > trialEndsAt : false;
        const premiumPaused = Boolean(h?.subscription?.premiumPaused) || (trialExpired && !paid);

        const hLat = toNumberOrNull(h?.location?.lat);
        const hLng = toNumberOrNull(h?.location?.lng);
        const distanceKm =
          enableDistanceSort && hLat !== null && hLng !== null
            ? haversineKm(lat, lng, hLat, hLng)
            : null;

        const consultationModes = [
          h?.features?.realtime ? "VIDEO" : "IN_PERSON",
          h?.features?.ai ? "VOICE" : null,
        ].filter(Boolean);
        const specialties = [
          h?.customization?.clinical?.specialties?.[0] || "General Care",
          h?.customization?.clinical?.specialties?.[1] || "Diagnostics",
        ].filter(Boolean);
        const liveQueueLength = Math.max(0, (Number(h?.customization?.clinical?.queueLength) || 0));
        const liveWaitingTime = Math.max(0, Number(h?.customization?.clinical?.averageWaitMinutes) || 12 + (distanceKm ? Math.round(distanceKm * 2) : 0));
        const liveAvailability = h?.features?.realtime ? "LIVE" : "STANDARD";

        return {
          _id: h._id,
          name: h.name,
          code: h.code,
          address: h.address,
          contact: h.contact,
          type: h.type,
          location: h.location || {},
          distanceKm,
          verification: {
            registrationNumber: h?.verification?.registrationNumber || "",
            approvalDate: h?.verification?.approvalDate || null,
            badgeLabel: h?.verification?.badgeLabel || "Government Approved",
          },
          subscriptionState: {
            status,
            trialEndsAt,
            trialExpired,
            premiumPaused,
          },
          insuranceProviders: (h.insuranceProviders || []).filter((i) => i?.enabled !== false),
          patientPaymentMethods: (h.patientPaymentMethods || []).filter((m) => m?.enabled !== false),
          waitingTime: liveWaitingTime,
          queueLength: liveQueueLength,
          queueLabel: liveQueueLength ? `${liveQueueLength} patients ahead` : "Open now",
          consultationModes,
          specialties,
          rating: Number(h?.customization?.branding?.rating || 4.8).toFixed(1),
          availability: liveAvailability,
          liveStatus: premiumPaused ? "PAUSED" : liveAvailability,
          services: [
            h?.features?.lab ? "Lab" : null,
            h?.features?.pharmacy ? "Pharmacy" : null,
            h?.features?.payments ? "Billing" : null,
            h?.features?.ai ? "AI Assist" : null,
          ].filter(Boolean),
        };
      })
      .filter((row) => {
        if (!enableDistanceSort || row.distanceKm === null) return true;
        return row.distanceKm <= radiusKm;
      })
      .sort((a, b) => {
        if (!enableDistanceSort) return String(a.name || "").localeCompare(String(b.name || ""));
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });

    const total = mapped.length;
    const start = (page - 1) * limit;
    const items = mapped.slice(start, start + limit);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};
