import crypto from "crypto";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
// Register Report model so populate("medicalRecords") works in environments that don't eagerly load all models.
import "../models/Report.js";
import FamilyAnchorApproval from "../models/FamilyAnchorApproval.js";
import { buildBusinessIdSearchFilter } from "../utils/businessIdSearch.js";
import { denyAudit } from "../middleware/denyAudit.js";
import { audit } from "../utils/audit.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { isMinorDob } from "../services/familyMonitoringService.js";
import { issuePasswordResetLink, resolveFrontendBase } from "../utils/passwordReset.js";
import { queueBrevoContactSync } from "../services/brevoContacts.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";
import { setOtp, getOtp, delOtp } from "../services/otpStore.js";
import { sendSMS } from "../services/notificationService.js";

function resolveActorHospitalId(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

function resolveScopedHospitalId(req) {
  const actorRole = String(req.user?.role || "").toUpperCase();
  const actorHospitalId = req.user?.hospitalId || req.user?.hospital;
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole)) {
    return req.query?.hospitalId || actorHospitalId || null;
  }
  return actorHospitalId;
}

function normalizeNationalId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCountryCode(value) {
  return String(value || "").trim().toUpperCase();
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildFamilyAnchorOtpKey({ nationalIdNumber, nationalIdCountry = "KE" }) {
  return `family-anchor:${normalizeCountryCode(nationalIdCountry) || "KE"}:${normalizeNationalId(nationalIdNumber)}`;
}

function inferFamilyMemberType({ patientDob = null, relationship = "" }) {
  if (isMinorDob(patientDob)) return "CHILD";
  const normalized = String(relationship || "").trim().toUpperCase();
  if (normalized === "SPOUSE") return "SPOUSE";
  if (["DEPENDENT", "CAREGIVER"].includes(normalized)) return "DEPENDENT";
  return "OTHER";
}

async function getFamilyAccessSettings() {
  const settings = await getSystemSettingsDoc({ lean: true });
  const familyAccess = settings?.clinical?.familyAccess || {};
  return {
    settings,
    requireOtpForFamilyAnchor: familyAccess.requireOtpForFamilyAnchor !== false,
    allowSingleAnchorForSpouseAndChildren: familyAccess.allowSingleAnchorForSpouseAndChildren !== false,
    otpTtlSeconds: Number(familyAccess.otpTtlSeconds || 600),
  };
}

async function upsertFamilyAnchorApproval({
  nationalIdNumber,
  nationalIdCountry = "KE",
  displayName = "",
  phone = "",
  actorId = null,
  anchorUser = null,
  notes = "",
}) {
  const normalizedId = normalizeNationalId(nationalIdNumber);
  const normalizedCountry = normalizeCountryCode(nationalIdCountry) || "KE";
  if (!normalizedId) return null;

  const approval =
    (await FamilyAnchorApproval.findOne({
      anchorNationalIdNumber: normalizedId,
      anchorNationalIdCountry: normalizedCountry,
    })) ||
    (await FamilyAnchorApproval.create({
      anchorNationalIdNumber: normalizedId,
      anchorNationalIdCountry: normalizedCountry,
    }));

  approval.anchorDisplayName = displayName || approval.anchorDisplayName || anchorUser?.name || "";
  approval.anchorPhone = phone || approval.anchorPhone || anchorUser?.phone || "";
  approval.anchorUser = anchorUser?._id || approval.anchorUser || null;
  approval.lastRequestedBy = actorId || approval.lastRequestedBy || null;
  approval.notes = String(notes || approval.notes || "").trim();

  if (approval.anchorUser && approval.status !== "APPROVED") {
    approval.status = "APPROVED";
    approval.approvalChannel = "ACCOUNT_LINK";
    approval.approvedAt = approval.approvedAt || new Date();
    approval.approvedByUser = approval.anchorUser;
    approval.approvedByNationalId = normalizedId;
    approval.approvedByPhone = approval.anchorPhone || approval.approvedByPhone || "";
  }

  await approval.save();
  return approval;
}

function syncFamilyAnchorApprovalMember({
  approval,
  patient,
  relationship = "CHILD",
  linkedBy = null,
  hospitalId = null,
}) {
  if (!approval || !patient) return;
  approval.members = [
    ...(approval.members || []).filter((item) => String(item.patient) !== String(patient._id)),
    {
      patient: patient._id,
      relationship: String(relationship || "CHILD").trim() || "CHILD",
      memberType: inferFamilyMemberType({ patientDob: patient.dob, relationship }),
      hospital: hospitalId || patient.hospital || null,
      linkedAt: new Date(),
      linkedBy: linkedBy || null,
      status: approval.status === "APPROVED" ? "APPROVED" : "PENDING",
    },
  ];
}

function syncGuardianMinorLink({ guardian, patient, linkedBy, relationship = "PARENT", notes = "" }) {
  if (!guardian || !patient) return;
  guardian.familyMonitoring = guardian.familyMonitoring || {};
  guardian.familyMonitoring.linkedMinorPatients = [
    ...(guardian.familyMonitoring.linkedMinorPatients || []).filter(
      (link) => String(link.patient) !== String(patient._id)
    ),
    {
      patient: patient._id,
      relationship: String(relationship || "PARENT").trim() || "PARENT",
      status: "ACTIVE",
      linkedAt: new Date(),
      linkedBy,
      notes: String(notes || "").trim(),
    },
  ];
}

function syncPatientGuardianLink({ guardian, patient, linkedBy, relationship = "PARENT", notes = "" }) {
  if (!guardian || !patient) return;
  patient.guardianLinks = [
    ...(patient.guardianLinks || []).filter(
      (link) => String(link.user) !== String(guardian._id)
    ),
    {
      user: guardian._id,
      relationship: String(relationship || "PARENT").trim() || "PARENT",
      status: "ACTIVE",
      canMonitor: true,
      linkedAt: new Date(),
      linkedBy,
      notes: String(notes || "").trim(),
    },
  ];
}

function syncPatientFamilyAnchor({
  patient,
  guardian = null,
  approval = null,
  guardianNationalIdNumber = "",
  guardianNationalIdCountry = "",
  guardianDisplayName = "",
  guardianPhone = "",
  relationship = "PARENT",
  memberType = "CHILD",
  linkedBy = null,
  notes = "",
  registrationSource = "HOSPITAL_STAFF",
}) {
  if (!patient) return;
  const parentNationalIdNumber =
    normalizeNationalId(guardianNationalIdNumber) ||
    normalizeNationalId(guardian?.nationalIdNumber);
  const parentNationalIdCountry =
    normalizeCountryCode(guardianNationalIdCountry) ||
    normalizeCountryCode(guardian?.nationalIdCountry);

  if (!guardian && !parentNationalIdNumber) return;

  patient.familyGroup = {
    ...(patient.familyGroup || {}),
    familyAnchorApproval: approval?._id || patient.familyGroup?.familyAnchorApproval || null,
    parentUser: guardian?._id || patient.familyGroup?.parentUser || null,
    parentNationalIdNumber,
    parentNationalIdCountry,
    relationship: String(relationship || "PARENT").trim() || "PARENT",
    memberType: memberType || patient.familyGroup?.memberType || inferFamilyMemberType({ patientDob: patient.dob, relationship }),
    registrationSource,
    approvalStatus:
      approval?.status === "APPROVED"
        ? "APPROVED"
        : approval
          ? "PENDING"
          : patient.familyGroup?.approvalStatus || "PENDING",
    approvalChannel: approval?.approvalChannel || patient.familyGroup?.approvalChannel || "NONE",
    approvalRequestedAt: approval?.otpRequestedAt || patient.familyGroup?.approvalRequestedAt || null,
    approvalApprovedAt: approval?.approvedAt || patient.familyGroup?.approvalApprovedAt || null,
    verifiedBy: linkedBy || null,
    verifiedAt: new Date(),
    parentDisplayName: guardian?.name || guardianDisplayName || patient.familyGroup?.parentDisplayName || "",
    parentPhone: guardian?.phone || guardianPhone || patient.familyGroup?.parentPhone || "",
    notes: String(notes || "").trim(),
  };
}

async function resolveGuardianByNationalId({ hospitalId, nationalIdNumber, nationalIdCountry = "" }) {
  const normalizedNationalIdNumber = normalizeNationalId(nationalIdNumber);
  const normalizedNationalIdCountry = normalizeCountryCode(nationalIdCountry);
  if (!normalizedNationalIdNumber) return null;

  const hospitalScope = hospitalId
    ? [{ hospital: hospitalId }, { hospital: null }, { hospital: { $exists: false } }]
    : [{ hospital: null }, { hospital: { $exists: false } }];

  return User.findOne({
    active: true,
    role: { $in: ["PATIENT", "GUEST"] },
    nationalIdNumber: normalizedNationalIdNumber,
    ...(normalizedNationalIdCountry ? { nationalIdCountry: normalizedNationalIdCountry } : {}),
    $or: hospitalScope,
  })
    .sort({
      hospital: hospitalId ? -1 : 1,
      updatedAt: -1,
    })
    .select("_id name email phone role familyMonitoring hospital nationalIdNumber nationalIdCountry");
}

/**
 * CREATE PATIENT
 * ✔ Hospital enforced from logged-in user
 * ✔ Patient limit enforced
 * ✔ Soft-delete safe
 */
export const createPatient = async (req, res, next) => {
  try {
    const hospitalId = resolveActorHospitalId(req);
    const {
      guardianAccountId = null,
      guardianRelationship = "PARENT",
      guardianNotes = "",
      guardianNationalIdNumber = "",
      guardianNationalIdCountry = "",
      guardianDisplayName = "",
      guardianPhone = "",
      useFamilyAnchor = false,
      createGuardianAccount = null,
      ...patientPayload
    } = req.body || {};
    const isMinor = isMinorDob(patientPayload?.dob);
    const shouldApplyFamilyAnchor =
      isMinor ||
      Boolean(useFamilyAnchor) ||
      Boolean(guardianNationalIdNumber || guardianDisplayName || guardianPhone);
    const shouldLinkGuardian =
      Boolean(guardianAccountId || createGuardianAccount || guardianNationalIdNumber) &&
      (isMinor || Boolean(useFamilyAnchor));
    let guardian = null;
    let guardianInvite = null;
    let familyAnchorApproval = null;
    const familyAccessSettings = await getFamilyAccessSettings();

    /* ================= LOAD HOSPITAL LIMITS ================= */
    const hospital = await Hospital.findOne({
      _id: hospitalId,
      active: true,
    }).select("limits");

    if (!hospital) {
      return res.status(403).json({
        message: "Hospital inactive or not found",
      });
    }

    /* ================= COUNT ACTIVE PATIENTS ================= */
    const patientCount = await Patient.countDocuments({
      hospital: hospitalId,
      active: true,
    });

    if (
      hospital.limits?.patients &&
      patientCount >= hospital.limits.patients
    ) {
      await denyAudit(
        req,
        res,
        "Patient limit exceeded"
      );

      return res.status(403).json({
        message:
          "Patient limit reached. Upgrade plan to add more patients.",
      });
    }

    if (shouldLinkGuardian) {
      if (guardianAccountId) {
        guardian = await User.findOne({
          _id: guardianAccountId,
          active: true,
        }).select("_id name phone role familyMonitoring hospital nationalIdNumber nationalIdCountry");
      } else if (createGuardianAccount && typeof createGuardianAccount === "object") {
        const name = String(createGuardianAccount.name || "").trim();
        const email = String(createGuardianAccount.email || "").trim().toLowerCase();
        const phone = String(createGuardianAccount.phone || "").trim();
        const nationalIdNumber = normalizeNationalId(createGuardianAccount.nationalIdNumber);
        const nationalIdCountry = normalizeCountryCode(createGuardianAccount.nationalIdCountry);

        if (!name || !email) {
          return res.status(400).json({ message: "Parent name and email are required to create and invite a new parent account" });
        }

        guardian = await User.findOne({
          active: true,
          $or: [{ email }, ...(phone ? [{ phone }] : [])],
        }).select("_id name email phone role familyMonitoring hospital nationalIdNumber nationalIdCountry");

        if (!guardian) {
          guardian = await User.create({
            name,
            email,
            phone: phone || undefined,
            role: "PATIENT",
            hospital: hospitalId,
            password: crypto.randomBytes(18).toString("base64url"),
            authProvider: "local",
            active: true,
            nationalIdNumber: nationalIdNumber || undefined,
            nationalIdCountry: nationalIdCountry || undefined,
            metadata: {
              invitedAsGuardian: true,
              invitedBy: req.user._id,
            },
          });

          guardianInvite = await issuePasswordResetLink({
            user: guardian,
            frontendBase: resolveFrontendBase(req),
            actorId: req.user._id,
            actorRole: req.user?.role || null,
            invite: true,
            metadata: {
              kind: "MINOR_GUARDIAN_INVITE",
              invitedForMinorRegistration: true,
            },
          });

          queueBrevoContactSync(guardian, { source: "MINOR_GUARDIAN_INVITE" });
        }
      }

      if (!guardian && guardianNationalIdNumber) {
        guardian = await resolveGuardianByNationalId({
          hospitalId,
          nationalIdNumber: guardianNationalIdNumber,
          nationalIdCountry: guardianNationalIdCountry,
        });
      }

      if (!guardian && guardianAccountId) {
        return res.status(400).json({ message: "Selected parent account was not found" });
      }
    }

    /* ================= CREATE PATIENT ================= */
    const patient = await Patient.create({
      ...patientPayload,
      hospital: hospitalId, // 🔐 tenant enforced
      createdBy: req.user._id,
      active: true,
    });

    if (guardian && isMinorDob(patient.dob)) {
      syncGuardianMinorLink({
        guardian,
        patient,
        linkedBy: req.user._id,
        relationship: guardianRelationship,
        notes: guardianNotes,
      });
      syncPatientGuardianLink({
        guardian,
        patient,
        linkedBy: req.user._id,
        relationship: guardianRelationship,
        notes: guardianNotes,
      });
    }

    if (shouldApplyFamilyAnchor) {
      familyAnchorApproval = await upsertFamilyAnchorApproval({
        nationalIdNumber: guardianNationalIdNumber || guardian?.nationalIdNumber,
        nationalIdCountry: guardianNationalIdCountry || guardian?.nationalIdCountry,
        displayName: guardianDisplayName || guardian?.name || "",
        phone: guardianPhone || guardian?.phone || "",
        actorId: req.user._id,
        anchorUser: guardian,
        notes: guardianNotes,
      });

      if (
        familyAccessSettings.requireOtpForFamilyAnchor &&
        !guardian &&
        !createGuardianAccount &&
        familyAnchorApproval &&
        familyAnchorApproval.status !== "APPROVED"
      ) {
        return res.status(409).json({
          message:
            "Family anchor approval is still pending. Send and verify the OTP on the anchor phone before registering this patient under the national ID.",
        });
      }
    }

    if (shouldApplyFamilyAnchor) {
      syncPatientFamilyAnchor({
        patient,
        guardian,
        approval: familyAnchorApproval,
        guardianNationalIdNumber,
        guardianNationalIdCountry,
        guardianDisplayName,
        guardianPhone,
        relationship: guardianRelationship,
        memberType: inferFamilyMemberType({ patientDob: patient.dob, relationship: guardianRelationship }),
        linkedBy: req.user._id,
        notes: guardianNotes,
        registrationSource: "HOSPITAL_STAFF",
      });
    }

    if (familyAnchorApproval) {
      syncFamilyAnchorApprovalMember({
        approval: familyAnchorApproval,
        patient,
        relationship: guardianRelationship,
        linkedBy: req.user._id,
        hospitalId,
      });
    }

    if (guardian || patient.familyGroup?.parentNationalIdNumber || familyAnchorApproval) {
      await Promise.all([
        guardian ? guardian.save() : Promise.resolve(),
        familyAnchorApproval ? familyAnchorApproval.save() : Promise.resolve(),
        patient.save(),
      ]);
    }

    if (guardian && isMinorDob(patient.dob)) {
      await audit({
        req,
        action: "REGISTER_MINOR_WITH_GUARDIAN_LINK",
        resource: "Patient",
        resourceId: patient._id,
        metadata: {
          guardianAccountId: guardian._id,
          guardianRelationship: guardianRelationship || "PARENT",
          guardianNationalIdNumber:
            normalizeNationalId(guardianNationalIdNumber) ||
            normalizeNationalId(guardian?.nationalIdNumber),
        },
      });
    } else if (patient.familyGroup?.parentNationalIdNumber) {
      await audit({
        req,
        action: isMinorDob(patient.dob) ? "REGISTER_MINOR_WITH_PARENT_NATIONAL_ID" : "REGISTER_PATIENT_WITH_FAMILY_ANCHOR",
        resource: "Patient",
        resourceId: patient._id,
        metadata: {
          guardianRelationship: guardianRelationship || "PARENT",
          guardianNationalIdNumber: patient.familyGroup.parentNationalIdNumber,
          guardianNationalIdCountry: patient.familyGroup.parentNationalIdCountry || "",
          familyAnchorApprovalStatus: patient.familyGroup.approvalStatus || "PENDING",
        },
      });
    }

    res.status(201).json({
      patient,
      guardianInviteIssued: Boolean(guardianInvite),
      guardianInviteExpiresAt: guardianInvite?.expiresAt || null,
    });
  } catch (err) {
    next(err);
  }
};

export const selfRegisterMinorPatient = async (req, res, next) => {
  try {
    const actor = await User.findById(req.user._id || req.user.id).select(
      "name phone role nationalIdNumber nationalIdCountry hospital familyMonitoring"
    );
    if (!actor) {
      return res.status(404).json({ message: "Parent account not found" });
    }

    const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || actor.role || "");
    if (!["PATIENT", "GUEST"].includes(actorRole)) {
      return res.status(403).json({ message: "Only patient or guardian accounts can self-register minors" });
    }

    if (!actor.nationalIdNumber) {
      return res.status(400).json({
        message: "Add your national ID to your profile before registering a child under your account",
      });
    }

    const {
      hospitalId: requestedHospitalId = null,
      relationship = "PARENT",
      notes = "",
      ...patientPayload
    } = req.body || {};

    if (!isMinorDob(patientPayload?.dob)) {
      return res.status(400).json({ message: "Only patients under 18 can be registered as minors under a parent account" });
    }

    const hospitalId = requestedHospitalId || actor.hospital || null;
    if (!hospitalId) {
      return res.status(400).json({ message: "Select a hospital for the child registration" });
    }

    const hospital = await Hospital.findOne({ _id: hospitalId, active: true }).select("limits");
    if (!hospital) {
      return res.status(404).json({ message: "Selected hospital was not found" });
    }

    const patientCount = await Patient.countDocuments({
      hospital: hospitalId,
      active: true,
    });
    if (hospital.limits?.patients && patientCount >= hospital.limits.patients) {
      return res.status(403).json({
        message: "Selected hospital has reached its patient plan limit. Choose another hospital or contact support.",
      });
    }

    const patient = await Patient.create({
      ...patientPayload,
      hospital: hospitalId,
      createdBy: actor._id,
      active: true,
      metadata: {
        ...(patientPayload?.metadata || {}),
        selfRegisteredMinor: true,
        parentUserId: actor._id,
      },
    });

    syncGuardianMinorLink({
      guardian: actor,
      patient,
      linkedBy: actor._id,
      relationship,
      notes,
    });
    syncPatientGuardianLink({
      guardian: actor,
      patient,
      linkedBy: actor._id,
      relationship,
      notes,
    });
    const familyAnchorApproval = await upsertFamilyAnchorApproval({
      nationalIdNumber: actor.nationalIdNumber,
      nationalIdCountry: actor.nationalIdCountry,
      displayName: actor.name,
      phone: actor.phone,
      actorId: actor._id,
      anchorUser: actor,
      notes,
    });
    syncPatientFamilyAnchor({
      patient,
      guardian: actor,
      approval: familyAnchorApproval,
      guardianNationalIdNumber: actor.nationalIdNumber,
      guardianNationalIdCountry: actor.nationalIdCountry,
      guardianDisplayName: actor.name,
      guardianPhone: actor.phone,
      relationship,
      memberType: "CHILD",
      linkedBy: actor._id,
      notes,
      registrationSource: "SELF_SERVICE",
    });
    syncFamilyAnchorApprovalMember({
      approval: familyAnchorApproval,
      patient,
      relationship,
      linkedBy: actor._id,
      hospitalId,
    });

    await Promise.all([actor.save(), familyAnchorApproval.save(), patient.save()]);

    await audit({
      req,
      action: "SELF_REGISTER_MINOR",
      resource: "Patient",
      resourceId: patient._id,
      metadata: {
        parentUserId: actor._id,
        parentNationalIdNumber: actor.nationalIdNumber,
        relationship,
        hospitalId,
      },
    });

    res.status(201).json({
      patient,
      linkedToParent: true,
      parentNationalIdNumber: actor.nationalIdNumber,
    });
  } catch (err) {
    next(err);
  }
};

export const requestFamilyAnchorApprovalOtp = async (req, res, next) => {
  try {
    const {
      nationalIdNumber = "",
      nationalIdCountry = "KE",
      phone = "",
      displayName = "",
      notes = "",
    } = req.body || {};

    const normalizedId = normalizeNationalId(nationalIdNumber);
    const normalizedCountry = normalizeCountryCode(nationalIdCountry) || "KE";
    const normalizedPhone = String(phone || "").trim();
    if (!normalizedId || !normalizedPhone) {
      return res.status(400).json({ message: "Family anchor national ID and phone are required" });
    }

    const { requireOtpForFamilyAnchor, otpTtlSeconds } = await getFamilyAccessSettings();
    if (!requireOtpForFamilyAnchor) {
      return res.status(400).json({ message: "Family anchor OTP approval is disabled in system settings" });
    }

    const anchorUser = await resolveGuardianByNationalId({
      hospitalId: resolveActorHospitalId(req),
      nationalIdNumber: normalizedId,
      nationalIdCountry: normalizedCountry,
    });

    const approval = await upsertFamilyAnchorApproval({
      nationalIdNumber: normalizedId,
      nationalIdCountry: normalizedCountry,
      displayName,
      phone: normalizedPhone,
      actorId: req.user?._id || req.user?.id || null,
      anchorUser,
      notes,
    });

    const otpKey = buildFamilyAnchorOtpKey({
      nationalIdNumber: normalizedId,
      nationalIdCountry: normalizedCountry,
    });
    const otp = generateOtpCode();
    await setOtp(otpKey, otp, otpTtlSeconds);
    approval.status = "PENDING";
    approval.approvalChannel = "OTP";
    approval.otpRequestedAt = new Date();
    approval.anchorPhone = normalizedPhone;
    approval.lastRequestedBy = req.user?._id || req.user?.id || null;
    await approval.save();

    let smsResult = { provider: "test" };
    if (process.env.NODE_ENV !== "test") {
      try {
        smsResult = await sendSMS({
          to: normalizedPhone,
          message: `AfyaLink family approval code: ${otp}. Use this to confirm that national ID ${normalizedId} can anchor your family record. Expires in ${Math.round(otpTtlSeconds / 60)} minutes.`,
        });
      } catch (smsErr) {
        await delOtp(otpKey);
        return res.status(502).json({
          message:
            smsErr?.message ||
            "We could not send the family approval OTP right now. Please confirm the SMS channel and try again.",
        });
      }

      if (!smsResult || smsResult.provider === "log") {
        await delOtp(otpKey);
        return res.status(503).json({
          message:
            "SMS delivery is not configured yet for family approvals. Add a live SMS provider before using this flow.",
        });
      }
    }

    await audit({
      req,
      action: "FAMILY_ANCHOR_OTP_REQUESTED",
      resource: "FamilyAnchorApproval",
      resourceId: approval._id,
      metadata: {
        anchorNationalIdNumber: normalizedId,
        anchorNationalIdCountry: normalizedCountry,
        anchorPhone: normalizedPhone,
      },
    });

    res.json({
      success: true,
      message: "OTP sent to the family anchor phone number.",
      approvalId: approval._id,
      expiresInSeconds: otpTtlSeconds,
      anchorNationalIdNumber: normalizedId,
      anchorNationalIdCountry: normalizedCountry,
      provider: smsResult.provider,
      ...(process.env.NODE_ENV === "test" ? { testOtp: otp } : {}),
    });
  } catch (err) {
    next(err);
  }
};

export const verifyFamilyAnchorApprovalOtp = async (req, res, next) => {
  try {
    const {
      nationalIdNumber = "",
      nationalIdCountry = "KE",
      otp = "",
      phone = "",
      displayName = "",
    } = req.body || {};

    const normalizedId = normalizeNationalId(nationalIdNumber);
    const normalizedCountry = normalizeCountryCode(nationalIdCountry) || "KE";
    const normalizedOtp = String(otp || "").trim();
    if (!normalizedId || !normalizedOtp) {
      return res.status(400).json({ message: "Family anchor national ID and OTP are required" });
    }

    const savedOtp = await getOtp(
      buildFamilyAnchorOtpKey({ nationalIdNumber: normalizedId, nationalIdCountry: normalizedCountry })
    );
    if (!savedOtp || savedOtp !== normalizedOtp) {
      return res.status(401).json({ message: "Invalid or expired family approval OTP" });
    }

    await delOtp(buildFamilyAnchorOtpKey({ nationalIdNumber: normalizedId, nationalIdCountry: normalizedCountry }));

    const approval =
      (await FamilyAnchorApproval.findOne({
        anchorNationalIdNumber: normalizedId,
        anchorNationalIdCountry: normalizedCountry,
      })) ||
      (await FamilyAnchorApproval.create({
        anchorNationalIdNumber: normalizedId,
        anchorNationalIdCountry: normalizedCountry,
      }));

    approval.status = "APPROVED";
    approval.approvalChannel = "OTP";
    approval.otpVerifiedAt = new Date();
    approval.approvedAt = new Date();
    approval.approvedByUser = approval.anchorUser || null;
    approval.approvedByPhone = String(phone || approval.anchorPhone || "").trim();
    approval.approvedByNationalId = normalizedId;
    approval.anchorDisplayName = displayName || approval.anchorDisplayName || "";
    approval.anchorPhone = String(phone || approval.anchorPhone || "").trim();

    approval.members = (approval.members || []).map((member) => ({
      ...(member.toObject?.() || member),
      status: "APPROVED",
    }));
    await approval.save();

    await Patient.updateMany(
      {
        active: true,
        "familyGroup.parentNationalIdNumber": normalizedId,
        "familyGroup.parentNationalIdCountry": normalizedCountry,
      },
      {
        $set: {
          "familyGroup.familyAnchorApproval": approval._id,
          "familyGroup.approvalStatus": "APPROVED",
          "familyGroup.approvalChannel": "OTP",
          "familyGroup.approvalApprovedAt": approval.approvedAt,
          "familyGroup.approvalRequestedAt": approval.otpRequestedAt || new Date(),
          "familyGroup.parentDisplayName": approval.anchorDisplayName || "",
          "familyGroup.parentPhone": approval.anchorPhone || "",
        },
      }
    );

    await audit({
      req,
      action: "FAMILY_ANCHOR_OTP_VERIFIED",
      resource: "FamilyAnchorApproval",
      resourceId: approval._id,
      metadata: {
        anchorNationalIdNumber: normalizedId,
        anchorNationalIdCountry: normalizedCountry,
      },
    });

    res.json({
      success: true,
      message: "Family anchor approved. The father national ID can now serve approved spouse and child records tied to this family anchor.",
      approvalId: approval._id,
      status: approval.status,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * LIST PATIENTS
 * Paged hospital-scoped listing for high-volume usage
 */
export const listPatients = async (req, res, next) => {
  try {
    const hospitalId = resolveScopedHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital is required" });
    }
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const cursor = req.query.cursor || null;
    const cursorMode =
      req.query.cursorMode === "1" ||
      req.query.cursorMode === "true" ||
      Object.prototype.hasOwnProperty.call(req.query, "cursor");
    const q = (req.query.q || "").trim();

    const filter = { hospital: hospitalId, active: true };
    if (q) {
      filter.$or = buildBusinessIdSearchFilter(q, ["patientId"], [
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { nationalId: new RegExp(q, "i") },
      ]).$or;
    }

    if (cursorMode) {
      let cursorFilter = { ...filter };
      if (cursor) {
        const parsed = decodeCursor(cursor);
        if (!parsed?.createdAt || !parsed?._id) {
          return res.status(400).json({ message: "Invalid cursor" });
        }
        cursorFilter = {
          ...filter,
          $or: [
            { createdAt: { $lt: new Date(parsed.createdAt) } },
            { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
          ],
        };
      }
      const rows = await Patient.find(cursorFilter)
        .select("-__v")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;
      return res.json({ items, nextCursor, hasMore, limit });
    }

    const [items, total] = await Promise.all([
      Patient.find(filter)
        .select("-__v")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Patient.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET SINGLE PATIENT
 * Tenant isolation + soft-delete guard + audit on deny
 */
export const getPatient = async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const query = { active: true };

    if (mongoose.isValidObjectId(id)) {
      query.$or = [{ _id: id }, { patientId: id }];
    } else {
      query.patientId = id;
    }

    const patient = await Patient.findOne(query).populate("hospital primaryDoctor medicalRecords");

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // 🔐 TENANT ISOLATION CHECK
    if (
      patient.hospital._id.toString() !==
      req.user.hospitalId.toString()
    ) {
      await denyAudit(
        req,
        res,
        "Cross-hospital patient access blocked"
      );

      return res.status(403).json({
        message: "Access denied",
      });
    }

    res.json(patient);
  } catch (err) {
    next(err);
  }
};

/**
 * SEARCH PATIENTS
 * Always scoped to hospital + active only
 */
export const searchPatients = async (req, res, next) => {
  try {
    const q = req.query.q || "";
    const hospitalId = resolveScopedHospitalId(req);

    // 🚫 Detect hospital override attempt
    if (req.query.hospital) {
      await denyAudit(
        req,
        res,
        "Attempt to override hospital filter in patient search"
      );

      return res.status(403).json({
        message: "Access denied",
      });
    }
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital is required" });
    }

    const searchQuery = {
      hospital: hospitalId, // 🔐 tenant scoped
      active: true, // 🔒 SOFT-DELETE FILTER
    };
    if (q) {
      searchQuery.$or = buildBusinessIdSearchFilter(q, ["patientId"], [
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { nationalId: new RegExp(q, "i") },
      ]).$or;
    }

    const patients = await Patient.find(searchQuery)
      .limit(50)
      .select("-__v");

    res.json(patients);
  } catch (err) {
    next(err);
  }
};

export const searchGuardianAccounts = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const hospitalId = resolveScopedHospitalId(req);
    if (!q) {
      return res.json({ items: [] });
    }

    const rows = await User.find({
      active: true,
      role: { $in: ["PATIENT", "GUEST"] },
      $and: [
        {
          $or: hospitalId
            ? [{ hospital: hospitalId }, { hospital: null }, { hospital: { $exists: false } }]
            : [{ hospital: null }, { hospital: { $exists: false } }],
        },
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
            { nationalIdNumber: { $regex: q, $options: "i" } },
          ],
        },
      ],
    })
      .select("name email phone role nationalIdNumber nationalIdCountry hospital")
      .limit(12)
      .lean();

    return res.json({
      items: rows.map((row) => ({
        _id: row._id,
        name: row.name || "Unnamed guardian",
        email: row.email || "",
        phone: row.phone || "",
        role: row.role || "PATIENT",
        nationalIdNumber: row.nationalIdNumber || "",
        nationalIdCountry: row.nationalIdCountry || "",
        hospital: row.hospital || null,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DEACTIVATE PATIENT (SOFT DELETE)
 * ✔ reversible
 * ✔ auditable
 * ✔ compliant
 */
export const deactivatePatient = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "A valid patient id is required" });
    }

    const hospitalId = resolveScopedHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const patient = await Patient.findOneAndUpdate(
      {
        _id: req.params.id,
        hospital: hospitalId, // 🔐 tenant scoped
        active: true,
      },
      { active: false },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    await audit({
      req,
      action: "DEACTIVATE_PATIENT",
      resource: "Patient",
      resourceId: patient._id,
    });

    res.json({
      message: "Patient deactivated",
    });
  } catch (err) {
    next(err);
  }
};
