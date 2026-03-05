import StaffTransferRequest from "../models/StaffTransferRequest.js";
import StaffTransferLetter from "../models/StaffTransferLetter.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import { audit } from "../utils/audit.js";
import { STAFF_ROLES, HOSPITAL_SCOPED_ROLES } from "../utils/roleSets.js";
import { evaluateStaffIdentityChecklist } from "../utils/staffIdentityChecklist.js";
import { verifySignatureWithReason } from "../utils/pkiVerifier.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const GLOBAL_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);
const LETTER_STORAGE_ROOT = path.resolve("backend/storage/transfer-letters");

function actorRole(req) {
  return String(req.user?.actualRole || req.user?.role || "").toUpperCase();
}

function actorHospital(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

function canManageTransferForHospital(req, hospitalId) {
  const role = actorRole(req);
  if (GLOBAL_ROLES.has(role)) return true;
  if (role === "HOSPITAL_ADMIN" || role === "HOSPITAL_ADMIN_ASSISTANT" || role === "HR_MANAGER") {
    return String(actorHospital(req)) === String(hospitalId);
  }
  return false;
}

function resolveSignatureInput(req) {
  const fromBody = req.body?.signature || req.body?.digitalSignature || null;
  const fromHeader =
    req.headers["x-transfer-signature"] ||
    req.headers["x-signature"] ||
    null;
  const signature = String(fromBody || fromHeader || "").trim();
  const keyId = String(req.body?.signatureKeyId || req.headers["x-signature-key-id"] || "").trim();
  return { signature, keyId };
}

function ensureStorageDir() {
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dir = path.join(LETTER_STORAGE_ROOT, y, m);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isAllowedTransferLetterMime(mime = "") {
  return new Set(["application/pdf", "image/png", "image/jpeg"]).has(String(mime).toLowerCase());
}

async function completeTransfer(req, transfer) {
  const user = await User.findById(transfer.staffUser);
  if (!user) {
    return { ok: false, message: "Staff user not found" };
  }

  if (!STAFF_ROLES.includes(String(user.role || "").toUpperCase())) {
    return { ok: false, message: "Only staff roles can be transferred" };
  }

  user.hospital = transfer.toHospital;
  user.employment = user.employment || {};
  user.employment.status = "ACTIVE";
  user.employment.transferRequest = null;
  user.employment.separationDate = undefined;
  user.employment.separationReason = undefined;
  await user.save();

  transfer.status = "COMPLETED";
  transfer.completedAt = new Date();
  transfer.actions.push({
    action: "COMPLETED",
    actor: req.user._id,
    actorRole: actorRole(req),
    note: "Transfer completed and staff linked to destination hospital",
  });
  await transfer.save();

  await audit({
    req,
    action: "STAFF_TRANSFER_COMPLETED",
    resource: "StaffTransferRequest",
    resourceId: transfer._id,
    metadata: {
      staffUser: transfer.staffUser,
      fromHospital: transfer.fromHospital,
      toHospital: transfer.toHospital,
      role: transfer.currentRole,
    },
  });

  return { ok: true, user };
}

export const createStaffTransferRequest = async (req, res) => {
  try {
    const { staffUserId, toHospitalId, transferLetterRef, transferLetterId, note } = req.body || {};
    if (!staffUserId || !toHospitalId) {
      return res.status(400).json({ message: "staffUserId and toHospitalId are required" });
    }

    const [staffUser, toHospital] = await Promise.all([
      User.findById(staffUserId),
      Hospital.findById(toHospitalId).select("_id name active"),
    ]);
    if (!staffUser) return res.status(404).json({ message: "Staff user not found" });
    if (!toHospital || toHospital.active === false) {
      return res.status(404).json({ message: "Destination hospital not found or inactive" });
    }

    const role = String(staffUser.role || "").toUpperCase();
    if (!STAFF_ROLES.includes(role) && role !== "HOSPITAL_ADMIN") {
      return res.status(400).json({ message: "Only hospital staff users can be transferred" });
    }
    if (!staffUser.hospital) {
      return res.status(400).json({ message: "Staff user has no source hospital" });
    }
    if (String(staffUser.hospital) === String(toHospitalId)) {
      return res.status(400).json({ message: "Destination hospital must be different from source hospital" });
    }

    if (!canManageTransferForHospital(req, staffUser.hospital)) {
      return res.status(403).json({ message: "Not allowed to initiate transfer from this hospital" });
    }

    const checklist = evaluateStaffIdentityChecklist(staffUser);
    if (!checklist.compliant) {
      return res.status(422).json({
        message: "Staff identity checklist incomplete. Complete required verification fields before transfer.",
        checklist,
      });
    }

    const existing = await StaffTransferRequest.findOne({
      staffUser: staffUser._id,
      status: { $in: ["PENDING_SOURCE_APPROVAL", "PENDING_TARGET_APPROVAL"] },
    }).lean();
    if (existing) {
      return res.status(409).json({ message: "An active transfer request already exists for this staff user" });
    }

    let transferLetter = null;
    const letterLookup = String(transferLetterId || transferLetterRef || "").trim();
    if (letterLookup) {
      transferLetter = await StaffTransferLetter.findById(letterLookup).lean();
      if (!transferLetter) {
        return res.status(404).json({ message: "Transfer letter not found. Upload the letter and retry." });
      }
      if (
        !GLOBAL_ROLES.has(actorRole(req)) &&
        transferLetter.hospital &&
        String(transferLetter.hospital) !== String(staffUser.hospital)
      ) {
        return res.status(403).json({ message: "Transfer letter does not belong to this hospital scope" });
      }
    }

    const transfer = await StaffTransferRequest.create({
      staffUser: staffUser._id,
      currentRole: role,
      fromHospital: staffUser.hospital,
      toHospital: toHospital._id,
      initiatedBy: req.user._id,
      transferLetterRef: String(letterLookup || "").trim(),
      transferLetter: transferLetter
        ? {
            letterId: transferLetter._id,
            sha256: transferLetter.sha256,
            signatureVerified: Boolean(transferLetter.signature?.verified),
            signatureReason: transferLetter.signature?.reason || null,
          }
        : undefined,
      note: String(note || "").trim(),
      status: "PENDING_SOURCE_APPROVAL",
      actions: [
        {
          action: "CREATED",
          actor: req.user._id,
          actorRole: actorRole(req),
          note: String(note || "Transfer request created").trim(),
        },
      ],
    });

    staffUser.employment = staffUser.employment || {};
    staffUser.employment.status = "TRANSFER_PENDING";
    staffUser.employment.transferRequest = transfer._id;
    await staffUser.save();

    await audit({
      req,
      action: "STAFF_TRANSFER_REQUEST_CREATED",
      resource: "StaffTransferRequest",
      resourceId: transfer._id,
      metadata: {
        staffUser: staffUser._id,
        fromHospital: staffUser.hospital,
        toHospital: toHospital._id,
        role,
      },
    });

    return res.status(201).json({ success: true, transfer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create staff transfer request" });
  }
};

export const listStaffTransferRequests = async (req, res) => {
  try {
    const role = actorRole(req);
    const status = String(req.query.status || "").toUpperCase();
    const q = String(req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const filter = {};
    if (status) filter.status = status;

    if (GLOBAL_ROLES.has(role)) {
      if (req.query.hospitalId) {
        filter.$or = [{ fromHospital: req.query.hospitalId }, { toHospital: req.query.hospitalId }];
      }
    } else if (role === "HOSPITAL_ADMIN" || role === "HR_MANAGER") {
      const hospital = actorHospital(req);
      filter.$or = [{ fromHospital: hospital }, { toHospital: hospital }];
    } else {
      filter.staffUser = req.user._id;
    }

    if (q) {
      const byStaff = await User.find({
        $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }],
      }).select("_id");
      const ids = byStaff.map((u) => u._id);
      if (!ids.length) {
        return res.json({ items: [], total: 0, page, limit });
      }
      filter.staffUser = { $in: ids };
    }

    const [items, total] = await Promise.all([
      StaffTransferRequest.find(filter)
        .populate("staffUser", "name email role hospital")
        .populate("fromHospital", "name code")
        .populate("toHospital", "name code")
        .populate("initiatedBy", "name email role")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StaffTransferRequest.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to list transfer requests" });
  }
};

export const approveSourceTransfer = async (req, res) => {
  try {
    const transfer = await StaffTransferRequest.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer request not found" });
    if (transfer.status !== "PENDING_SOURCE_APPROVAL") {
      return res.status(400).json({ message: "Transfer is not awaiting source approval" });
    }
    if (!canManageTransferForHospital(req, transfer.fromHospital)) {
      return res.status(403).json({ message: "Not allowed to approve source hospital transfer" });
    }

    transfer.sourceApproval = {
      by: req.user._id,
      at: new Date(),
      note: String(req.body?.note || "").trim(),
    };
    transfer.status = "PENDING_TARGET_APPROVAL";
    transfer.actions.push({
      action: "SOURCE_APPROVED",
      actor: req.user._id,
      actorRole: actorRole(req),
      note: String(req.body?.note || "").trim(),
    });
    await transfer.save();

    await audit({
      req,
      action: "STAFF_TRANSFER_SOURCE_APPROVED",
      resource: "StaffTransferRequest",
      resourceId: transfer._id,
      metadata: {
        staffUser: transfer.staffUser,
        fromHospital: transfer.fromHospital,
        toHospital: transfer.toHospital,
      },
    });

    return res.json({ success: true, transfer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to approve source transfer" });
  }
};

export const approveTargetTransfer = async (req, res) => {
  try {
    const transfer = await StaffTransferRequest.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer request not found" });
    if (transfer.status !== "PENDING_TARGET_APPROVAL") {
      return res.status(400).json({ message: "Transfer is not awaiting target approval" });
    }
    if (!canManageTransferForHospital(req, transfer.toHospital)) {
      return res.status(403).json({ message: "Not allowed to approve target hospital transfer" });
    }

    transfer.targetApproval = {
      by: req.user._id,
      at: new Date(),
      note: String(req.body?.note || "").trim(),
    };
    transfer.actions.push({
      action: "TARGET_APPROVED",
      actor: req.user._id,
      actorRole: actorRole(req),
      note: String(req.body?.note || "").trim(),
    });
    await transfer.save();

    const outcome = await completeTransfer(req, transfer);
    if (!outcome.ok) {
      return res.status(400).json({ message: outcome.message });
    }

    return res.json({ success: true, transfer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to approve target transfer" });
  }
};

export const rejectTransfer = async (req, res) => {
  try {
    const transfer = await StaffTransferRequest.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer request not found" });
    if (!["PENDING_SOURCE_APPROVAL", "PENDING_TARGET_APPROVAL"].includes(transfer.status)) {
      return res.status(400).json({ message: "Only active transfer requests can be rejected" });
    }

    const canReject =
      canManageTransferForHospital(req, transfer.fromHospital) ||
      canManageTransferForHospital(req, transfer.toHospital);
    if (!canReject) {
      return res.status(403).json({ message: "Not allowed to reject this transfer request" });
    }

    transfer.status = "REJECTED";
    transfer.rejectedAt = new Date();
    transfer.rejectedBy = req.user._id;
    transfer.rejectionReason = String(req.body?.reason || "").trim();
    transfer.actions.push({
      action: "REJECTED",
      actor: req.user._id,
      actorRole: actorRole(req),
      note: transfer.rejectionReason,
    });
    await transfer.save();

    const user = await User.findById(transfer.staffUser);
    if (user && HOSPITAL_SCOPED_ROLES.includes(String(user.role || "").toUpperCase())) {
      user.employment = user.employment || {};
      user.employment.status = "ACTIVE";
      user.employment.transferRequest = null;
      await user.save();
    }

    await audit({
      req,
      action: "STAFF_TRANSFER_REJECTED",
      resource: "StaffTransferRequest",
      resourceId: transfer._id,
      metadata: {
        staffUser: transfer.staffUser,
        fromHospital: transfer.fromHospital,
        toHospital: transfer.toHospital,
        reason: transfer.rejectionReason,
      },
    });

    return res.json({ success: true, transfer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to reject transfer request" });
  }
};

export const cancelTransfer = async (req, res) => {
  try {
    const transfer = await StaffTransferRequest.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer request not found" });
    if (!["PENDING_SOURCE_APPROVAL", "PENDING_TARGET_APPROVAL"].includes(transfer.status)) {
      return res.status(400).json({ message: "Only active transfer requests can be cancelled" });
    }

    const role = actorRole(req);
    const canCancel =
      GLOBAL_ROLES.has(role) ||
      String(transfer.initiatedBy) === String(req.user._id) ||
      canManageTransferForHospital(req, transfer.fromHospital);

    if (!canCancel) {
      return res.status(403).json({ message: "Not allowed to cancel this transfer request" });
    }

    transfer.status = "CANCELLED";
    transfer.actions.push({
      action: "CANCELLED",
      actor: req.user._id,
      actorRole: actorRole(req),
      note: String(req.body?.note || "").trim(),
    });
    await transfer.save();

    const user = await User.findById(transfer.staffUser);
    if (user && HOSPITAL_SCOPED_ROLES.includes(String(user.role || "").toUpperCase())) {
      user.employment = user.employment || {};
      user.employment.status = "ACTIVE";
      user.employment.transferRequest = null;
      await user.save();
    }

    await audit({
      req,
      action: "STAFF_TRANSFER_CANCELLED",
      resource: "StaffTransferRequest",
      resourceId: transfer._id,
      metadata: {
        staffUser: transfer.staffUser,
        fromHospital: transfer.fromHospital,
        toHospital: transfer.toHospital,
      },
    });

    return res.json({ success: true, transfer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to cancel transfer request" });
  }
};

export const uploadTransferLetter = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No transfer-letter file uploaded" });
    }
    if (!isAllowedTransferLetterMime(req.file.mimetype)) {
      return res.status(415).json({ message: "Only PDF, PNG, and JPEG transfer-letter files are allowed" });
    }

    const dir = ensureStorageDir();
    const ext = path.extname(req.file.originalname || "").toLowerCase() || ".bin";
    const fileName = `transfer-letter-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, req.file.buffer);

    const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const { signature, keyId } = resolveSignatureInput(req);
    const verify = verifySignatureWithReason(sha256, signature);

    const letter = await StaffTransferLetter.create({
      originalName: req.file.originalname,
      fileName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: path.relative(path.resolve("."), fullPath),
      sha256,
      uploadedBy: req.user._id,
      hospital: req.user?.hospital || null,
      signature: {
        provided: Boolean(signature),
        value: signature || "",
        algorithm: "RSA-SHA256",
        verified: verify.verified,
        reason: verify.reason,
        verifiedAt: verify.verified ? new Date() : null,
        keyId: keyId || "",
      },
    });

    await audit({
      req,
      action: "STAFF_TRANSFER_LETTER_UPLOADED",
      resource: "StaffTransferLetter",
      resourceId: letter._id,
      metadata: {
        sha256,
        mimeType: req.file.mimetype,
        signatureVerified: verify.verified,
        signatureReason: verify.reason,
      },
    });

    return res.status(201).json({
      success: true,
      letter: {
        id: letter._id,
        sha256: letter.sha256,
        originalName: letter.originalName,
        mimeType: letter.mimeType,
        size: letter.size,
        signatureVerified: letter.signature?.verified || false,
        signatureReason: letter.signature?.reason || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to upload transfer letter" });
  }
};
