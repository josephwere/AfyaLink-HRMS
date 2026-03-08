import RecruitmentAd from "../models/RecruitmentAd.js";
import RecruitmentApplication from "../models/RecruitmentApplication.js";
import User from "../models/User.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const recruitmentUploadsRoot = path.resolve(process.cwd(), "uploads", "recruitment-ads");
const recruitmentApplicationUploadsRoot = path.resolve(process.cwd(), "uploads", "recruitment-applications");
const allowedMediaMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const allowedResumeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const allowedRecruitmentSources = new Set([
  "LOGIN_PAGE",
  "REGISTER_PAGE",
  "PATIENT_DASHBOARD",
  "PATIENT_FEED",
  "DIRECT_CAREERS",
]);

const parseLines = (value) =>
  Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : String(value || "")
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);

const parseCsv = (value) =>
  Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : String(value || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

async function ensureRecruitmentUploadRoot() {
  await fs.mkdir(recruitmentUploadsRoot, { recursive: true });
}

async function ensureRecruitmentApplicationUploadRoot() {
  await fs.mkdir(recruitmentApplicationUploadsRoot, { recursive: true });
}

async function persistRecruitmentMedia(file, hospitalId, adId, slot) {
  if (!file) return null;
  if (!allowedMediaMimeTypes.has(file.mimetype)) {
    throw new Error("Only PNG, JPEG, WEBP, or GIF images are allowed for recruitment media.");
  }
  const folder = path.join(recruitmentUploadsRoot, String(hospitalId), String(adId));
  await fs.mkdir(folder, { recursive: true });
  const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
  const sha = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const filename = `${slot}-${sha.slice(0, 16)}${ext}`;
  const storagePath = path.join(folder, filename);
  await fs.writeFile(storagePath, file.buffer);
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath,
    publicUrl: `/uploads/recruitment-ads/${hospitalId}/${adId}/${filename}`,
    uploadedAt: new Date(),
  };
}

async function persistRecruitmentResume(file, hospitalId, adId, applicantId) {
  if (!file) return null;
  if (!allowedResumeMimeTypes.has(file.mimetype)) {
    throw new Error("Only PDF, DOC, DOCX, or TXT files are allowed for resumes.");
  }
  const folder = path.join(recruitmentApplicationUploadsRoot, String(hospitalId), String(adId), String(applicantId));
  await fs.mkdir(folder, { recursive: true });
  const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
  const sha = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const filename = `resume-${sha.slice(0, 16)}${ext}`;
  const storagePath = path.join(folder, filename);
  await fs.writeFile(storagePath, file.buffer);
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath,
    publicUrl: `/uploads/recruitment-applications/${hospitalId}/${adId}/${applicantId}/${filename}`,
    uploadedAt: new Date(),
  };
}

function normalizeRecruitmentSource(source) {
  const normalized = String(source || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return allowedRecruitmentSources.has(normalized) ? normalized : "";
}

async function incrementRecruitmentMetric(adId, metricField, source = "") {
  if (!adId || !metricField) return;
  const normalizedSource = normalizeRecruitmentSource(source);
  const update = {
    $inc: { [`analytics.${metricField}`]: 1 },
    $set: { "analytics.lastInteractionAt": new Date() },
  };
  if (normalizedSource) {
    update.$inc[`analytics.sourceAttribution.${normalizedSource}`] = 1;
    update.$inc[`analytics.eventSourceAttribution.${metricField}.${normalizedSource}`] = 1;
  }
  await RecruitmentAd.updateOne(
    { _id: adId },
    update
  );
}

export const createRecruitmentAd = async (req, res, next) => {
  try {
    const hospital = req.user?.hospital || req.user?.hospitalId;
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const body = req.body || {};
    if (!body.title || !body.description) {
      return res.status(400).json({ message: "title and description are required" });
    }
    const applicationMode = body.applicationMode ? String(body.applicationMode).trim().toUpperCase() : "INTERNAL";
    if ((applicationMode === "EXTERNAL" || applicationMode === "HYBRID") && !String(body.applyUrl || "").trim()) {
      return res.status(400).json({ message: "applyUrl is required for external or hybrid recruitment campaigns" });
    }
    const visibility = body.visibility ? String(body.visibility).trim().toUpperCase() : "PUBLIC";
    const privateAccessToken =
      visibility === "PRIVATE_LINK"
        ? crypto.createHash("sha256").update(`${hospital}:${Date.now()}:${body.title || ""}`).digest("hex").slice(0, 24)
        : "";
    const seededAd = new RecruitmentAd({
      hospital,
      createdBy: req.user.id,
      title: String(body.title).trim(),
      role: body.role ? String(body.role).trim() : "",
      department: body.department ? String(body.department).trim() : "",
      employmentType: body.employmentType ? String(body.employmentType).trim() : "",
      workMode: body.workMode ? String(body.workMode).trim().toUpperCase() : "ONSITE",
      location: body.location ? String(body.location).trim() : "",
      salaryRange: body.salaryRange ? String(body.salaryRange).trim() : "",
      hiringCount: Number(body.hiringCount || 1),
      seniorityLevel: body.seniorityLevel ? String(body.seniorityLevel).trim() : "",
      description: String(body.description).trim(),
      requirements: parseLines(body.requirements),
      benefits: parseLines(body.benefits),
      highlights: parseLines(body.highlights),
      tags: parseCsv(body.tags),
      campaignSummary: body.campaignSummary ? String(body.campaignSummary).trim() : "",
      bannerHeadline: body.bannerHeadline ? String(body.bannerHeadline).trim() : "",
      bannerSubheadline: body.bannerSubheadline ? String(body.bannerSubheadline).trim() : "",
      contactEmail: body.contactEmail ? String(body.contactEmail).trim().toLowerCase() : "",
      contactPhone: body.contactPhone ? String(body.contactPhone).trim() : "",
      applyUrl: body.applyUrl ? String(body.applyUrl).trim() : "",
      careersPageUrl: body.careersPageUrl ? String(body.careersPageUrl).trim() : "",
      videoUrl: body.videoUrl ? String(body.videoUrl).trim() : "",
      applicationMode,
      visibility,
      featured: body.featured === true || body.featured === "true",
      priority: Number(body.priority || 50),
      campaignStartAt: body.campaignStartAt ? new Date(body.campaignStartAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      status: "ACTIVE",
      media: {
        bannerLink: body.bannerLink ? String(body.bannerLink).trim() : "",
        brochureUrl: body.brochureUrl ? String(body.brochureUrl).trim() : "",
      },
      metadata: {
        privateAccessToken,
      },
    });
    await seededAd.save();
    await ensureRecruitmentUploadRoot();

    const coverImage = req.files?.coverImage?.[0] || null;
    const galleryFiles = Array.isArray(req.files?.galleryImages) ? req.files.galleryImages : [];
    if (coverImage) {
      seededAd.media.coverImage = await persistRecruitmentMedia(coverImage, hospital, seededAd._id, "cover");
    }
    if (galleryFiles.length) {
      seededAd.media.gallery = [];
      for (let i = 0; i < galleryFiles.length; i += 1) {
        const media = await persistRecruitmentMedia(galleryFiles[i], hospital, seededAd._id, `gallery-${i + 1}`);
        if (media) seededAd.media.gallery.push(media);
      }
    }
    await seededAd.save();

    return res.status(201).json({ success: true, ad: seededAd });
  } catch (err) {
    return next(err);
  }
};

export const listRecruitmentAds = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role) || "GUEST";
    const q = String(req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const filter = {};
    const andFilters = [];

    if (["PATIENT", "GUEST"].includes(role)) {
      filter.status = "ACTIVE";
      filter.visibility = "PUBLIC";
      andFilters.push({
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      });
      if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
    } else {
      const actorHospital = req.user?.hospital || req.user?.hospitalId;
      const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
      if (!privileged) filter.hospital = actorHospital;
      else if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
      if (req.query.status) filter.status = String(req.query.status).toUpperCase();
      if (req.query.visibility) filter.visibility = String(req.query.visibility).toUpperCase();
    }

    if (q) {
      andFilters.push({
        $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { department: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
        { campaignSummary: { $regex: q, $options: "i" } },
        ],
      });
    }

    if (andFilters.length) {
      filter.$and = andFilters;
    }

    const [items, total] = await Promise.all([
      RecruitmentAd.find(filter)
        .populate("hospital", "name code")
        .populate("createdBy", "name email")
        .sort({ featured: -1, priority: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RecruitmentAd.countDocuments(filter),
    ]);

    if (["PATIENT", "GUEST"].includes(role) && items.length) {
      const ids = items.map((item) => item._id).filter(Boolean);
      const source = normalizeRecruitmentSource(req.query.source);
      const update = {
        $inc: { "analytics.viewCount": 1 },
        $set: { "analytics.lastInteractionAt": new Date() },
      };
      if (source) {
        update.$inc[`analytics.sourceAttribution.${source}`] = 1;
        update.$inc[`analytics.eventSourceAttribution.viewCount.${source}`] = 1;
      }
      RecruitmentAd.updateMany({ _id: { $in: ids } }, update).catch(() => {});
    }

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};

export const trackRecruitmentAdEvent = async (req, res, next) => {
  try {
    const event = String(req.body?.event || "").trim().toUpperCase();
    const source = normalizeRecruitmentSource(req.body?.source);
    const metricMap = {
      APPLY_INTENT: "applyIntentCount",
      EXTERNAL_CLICK: "externalClickCount",
      CAREERS_PAGE_CLICK: "careersPageClickCount",
      BROCHURE_CLICK: "brochureClickCount",
      VIDEO_CLICK: "videoClickCount",
      BANNER_CLICK: "bannerClickCount",
      VIEW: "viewCount",
    };
    const metricField = metricMap[event];
    if (!metricField) {
      return res.status(400).json({ message: "Unsupported recruitment tracking event" });
    }

    const ad = await RecruitmentAd.findById(req.params.id).select("_id hospital");
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    await incrementRecruitmentMetric(ad._id, metricField, source);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const updateRecruitmentAd = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const actorHospital = req.user?.hospital || req.user?.hospitalId;

    const ad = await RecruitmentAd.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    if (!privileged && String(ad.hospital) !== String(actorHospital)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const body = req.body || {};
    const nextApplicationMode = body.applicationMode ? String(body.applicationMode).trim().toUpperCase() : ad.applicationMode;
    if ((nextApplicationMode === "EXTERNAL" || nextApplicationMode === "HYBRID") && body.applyUrl !== undefined && !String(body.applyUrl || "").trim()) {
      return res.status(400).json({ message: "applyUrl is required for external or hybrid recruitment campaigns" });
    }
    const fields = [
      "title",
      "role",
      "department",
      "employmentType",
      "workMode",
      "location",
      "salaryRange",
      "hiringCount",
      "seniorityLevel",
      "description",
      "contactEmail",
      "contactPhone",
      "applyUrl",
      "careersPageUrl",
      "videoUrl",
      "applicationMode",
      "visibility",
      "featured",
      "priority",
      "campaignSummary",
      "bannerHeadline",
      "bannerSubheadline",
      "status",
    ];
    fields.forEach((k) => {
      if (body[k] !== undefined) ad[k] = body[k];
    });
    if (body.expiresAt !== undefined) ad.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.campaignStartAt !== undefined) ad.campaignStartAt = body.campaignStartAt ? new Date(body.campaignStartAt) : null;
    if (body.requirements !== undefined) {
      ad.requirements = parseLines(body.requirements);
    }
    if (body.benefits !== undefined) ad.benefits = parseLines(body.benefits);
    if (body.highlights !== undefined) ad.highlights = parseLines(body.highlights);
    if (body.tags !== undefined) ad.tags = parseCsv(body.tags);
    ad.media = ad.media || {};
    if (body.bannerLink !== undefined) ad.media.bannerLink = String(body.bannerLink || "").trim();
    if (body.brochureUrl !== undefined) ad.media.brochureUrl = String(body.brochureUrl || "").trim();
    ad.metadata = ad.metadata || {};
    if (body.visibility !== undefined) {
      const nextVisibility = String(body.visibility || "").trim().toUpperCase();
      if (nextVisibility === "PRIVATE_LINK" && !ad.metadata.privateAccessToken) {
        ad.metadata.privateAccessToken = crypto
          .createHash("sha256")
          .update(`${ad.hospital}:${ad._id}:${Date.now()}`)
          .digest("hex")
          .slice(0, 24);
      }
      if (nextVisibility !== "PRIVATE_LINK") {
        ad.metadata.privateAccessToken = "";
      }
    }

    await ensureRecruitmentUploadRoot();
    const coverImage = req.files?.coverImage?.[0] || null;
    const galleryFiles = Array.isArray(req.files?.galleryImages) ? req.files.galleryImages : [];
    if (coverImage) {
      ad.media.coverImage = await persistRecruitmentMedia(coverImage, ad.hospital, ad._id, "cover");
    }
    if (galleryFiles.length) {
      ad.media.gallery = [];
      for (let i = 0; i < galleryFiles.length; i += 1) {
        const media = await persistRecruitmentMedia(galleryFiles[i], ad.hospital, ad._id, `gallery-${i + 1}`);
        if (media) ad.media.gallery.push(media);
      }
    }

    await ad.save();
    return res.json({ success: true, ad });
  } catch (err) {
    return next(err);
  }
};

export const applyToRecruitmentAd = async (req, res, next) => {
  try {
    const ad = await RecruitmentAd.findById(req.params.id).lean();
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    if (ad.status !== "ACTIVE") {
      return res.status(400).json({ message: "This vacancy is no longer accepting applications" });
    }
    if (ad.visibility === "PRIVATE_LINK" && req.body?.privateAccessToken !== ad?.metadata?.privateAccessToken) {
      return res.status(403).json({ message: "Private application link required for this vacancy" });
    }
    if (ad.expiresAt && new Date(ad.expiresAt) <= new Date()) {
      return res.status(400).json({ message: "This vacancy has expired" });
    }
    if (ad.applicationMode === "EXTERNAL") {
      return res.status(400).json({ message: "This vacancy accepts applications on an external application link only." });
    }

    const actor = await User.findById(req.user.id).select("name email phone role nationalIdNumber").lean();
    if (!actor) return res.status(404).json({ message: "Applicant not found" });

    const body = req.body || {};

    await ensureRecruitmentApplicationUploadRoot();
    const resumeFile = req.files?.resumeFile?.[0] || null;
    const persistedResume = resumeFile
      ? await persistRecruitmentResume(resumeFile, ad.hospital, ad._id, req.user.id)
      : null;

    const app = await RecruitmentApplication.create({
      ad: ad._id,
      hospital: ad.hospital,
      applicant: req.user.id,
      applicantRole: normalizeRole(actor.role),
      fullName: body.fullName ? String(body.fullName).trim() : actor.name,
      email: body.email ? String(body.email).trim().toLowerCase() : actor.email,
      phone: body.phone ? String(body.phone).trim() : actor.phone,
      coverLetter: body.coverLetter ? String(body.coverLetter).trim() : "",
      resumeUrl: body.resumeUrl ? String(body.resumeUrl).trim() : persistedResume?.publicUrl || "",
      resumeFile: persistedResume,
      experienceSummary: body.experienceSummary ? String(body.experienceSummary).trim() : "",
      metadata: {
        nationalIdNumber: actor.nationalIdNumber || "",
      },
    });

    await incrementRecruitmentMetric(ad._id, "internalApplyCount", body.source);

    return res.status(201).json({ success: true, application: app });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "You already applied to this vacancy" });
    }
    return next(err);
  }
};

export const listRecruitmentApplications = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const q = String(req.query.q || "").trim();
    const filter = {};

    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const canManageHospital = ["HOSPITAL_ADMIN", "HR_MANAGER", ...["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]].includes(role);

    if (req.query.mine === "1" || !canManageHospital) {
      filter.applicant = req.user.id;
    } else if (!privileged) {
      filter.hospital = req.user.hospital || req.user.hospitalId;
    } else if (req.query.hospitalId) {
      filter.hospital = req.query.hospitalId;
    }

    if (req.query.adId) filter.ad = req.query.adId;
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();

    if (q) {
      filter.$or = [
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      RecruitmentApplication.find(filter)
        .populate("ad", "title role department status")
        .populate("hospital", "name code")
        .populate("applicant", "name email role")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RecruitmentApplication.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};

export const updateRecruitmentApplicationStatus = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const actorHospital = req.user.hospital || req.user.hospitalId;

    const app = await RecruitmentApplication.findById(req.params.applicationId);
    if (!app) return res.status(404).json({ message: "Application not found" });

    if (!privileged && String(app.hospital) !== String(actorHospital)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const nextStatus = String(req.body?.status || "").toUpperCase();
    const allowed = ["NEW", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "HIRED"];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    app.status = nextStatus;
    app.reviewedBy = req.user.id;
    app.reviewedAt = new Date();
    app.reviewNote = req.body?.reviewNote ? String(req.body.reviewNote).trim() : app.reviewNote;
    await app.save();

    return res.json({ success: true, application: app });
  } catch (err) {
    return next(err);
  }
};
