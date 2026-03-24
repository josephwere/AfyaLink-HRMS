import crypto from "crypto";
import Patient from "../models/Patient.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import { denyAudit } from "../middleware/denyAudit.js";
import { audit } from "../utils/audit.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { isMinorDob } from "../services/familyMonitoringService.js";
import { issuePasswordResetLink, resolveFrontendBase } from "../utils/passwordReset.js";
import { queueBrevoContactSync } from "../services/brevoContacts.js";
import { normalizeRole } from "../utils/normalizeRole.js";

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
  guardianNationalIdNumber = "",
  guardianNationalIdCountry = "",
  guardianDisplayName = "",
  guardianPhone = "",
  relationship = "PARENT",
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
    parentUser: guardian?._id || patient.familyGroup?.parentUser || null,
    parentNationalIdNumber,
    parentNationalIdCountry,
    relationship: String(relationship || "PARENT").trim() || "PARENT",
    registrationSource,
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
      createGuardianAccount = null,
      ...patientPayload
    } = req.body || {};
    const isMinor = isMinorDob(patientPayload?.dob);
    const shouldLinkGuardian =
      Boolean(guardianAccountId || createGuardianAccount || guardianNationalIdNumber) && isMinor;
    let guardian = null;
    let guardianInvite = null;

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

    if (isMinorDob(patient.dob)) {
      syncPatientFamilyAnchor({
        patient,
        guardian,
        guardianNationalIdNumber,
        guardianNationalIdCountry,
        guardianDisplayName,
        guardianPhone,
        relationship: guardianRelationship,
        linkedBy: req.user._id,
        notes: guardianNotes,
        registrationSource: "HOSPITAL_STAFF",
      });
    }

    if (guardian || patient.familyGroup?.parentNationalIdNumber) {
      await Promise.all([
        guardian ? guardian.save() : Promise.resolve(),
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
        action: "REGISTER_MINOR_WITH_PARENT_NATIONAL_ID",
        resource: "Patient",
        resourceId: patient._id,
        metadata: {
          guardianRelationship: guardianRelationship || "PARENT",
          guardianNationalIdNumber: patient.familyGroup.parentNationalIdNumber,
          guardianNationalIdCountry: patient.familyGroup.parentNationalIdCountry || "",
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
    syncPatientFamilyAnchor({
      patient,
      guardian: actor,
      guardianNationalIdNumber: actor.nationalIdNumber,
      guardianNationalIdCountry: actor.nationalIdCountry,
      guardianDisplayName: actor.name,
      guardianPhone: actor.phone,
      relationship,
      linkedBy: actor._id,
      notes,
      registrationSource: "SELF_SERVICE",
    });

    await Promise.all([actor.save(), patient.save()]);

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
      filter.$or = [
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { nationalId: new RegExp(q, "i") },
      ];
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
    const { id } = req.params;

    const patient = await Patient.findOne({
      _id: id,
      active: true, // 🔒 SOFT-DELETE FILTER
    }).populate("hospital primaryDoctor medicalRecords");

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

    const patients = await Patient.find({
      hospital: hospitalId, // 🔐 tenant scoped
      active: true, // 🔒 SOFT-DELETE FILTER
      $or: [
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { nationalId: new RegExp(q, "i") },
      ],
    })
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
    const patient = await Patient.findOneAndUpdate(
      {
        _id: req.params.id,
        hospital: req.user.hospitalId, // 🔐 tenant scoped
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
