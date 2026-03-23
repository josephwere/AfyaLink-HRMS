import Patient from "../models/Patient.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import { denyAudit } from "../middleware/denyAudit.js";
import { audit } from "../utils/audit.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { isMinorDob } from "../services/familyMonitoringService.js";

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
      ...patientPayload
    } = req.body || {};
    const shouldLinkGuardian = Boolean(guardianAccountId) && isMinorDob(patientPayload?.dob);
    let guardian = null;

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
      guardian = await User.findOne({
        _id: guardianAccountId,
        active: true,
      }).select("_id role familyMonitoring hospital");

      if (!guardian) {
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
      guardian.familyMonitoring = guardian.familyMonitoring || {};
      guardian.familyMonitoring.linkedMinorPatients = [
        ...(guardian.familyMonitoring.linkedMinorPatients || []).filter(
          (link) => String(link.patient) !== String(patient._id)
        ),
        {
          patient: patient._id,
          relationship: String(guardianRelationship || "PARENT").trim() || "PARENT",
          status: "ACTIVE",
          linkedAt: new Date(),
          linkedBy: req.user._id,
          notes: String(guardianNotes || "").trim(),
        },
      ];

      patient.guardianLinks = [
        ...(patient.guardianLinks || []).filter(
          (link) => String(link.user) !== String(guardian._id)
        ),
        {
          user: guardian._id,
          relationship: String(guardianRelationship || "PARENT").trim() || "PARENT",
          status: "ACTIVE",
          canMonitor: true,
          linkedAt: new Date(),
          linkedBy: req.user._id,
          notes: String(guardianNotes || "").trim(),
        },
      ];

      await Promise.all([guardian.save(), patient.save()]);
      await audit({
        req,
        action: "REGISTER_MINOR_WITH_GUARDIAN_LINK",
        resource: "Patient",
        resourceId: patient._id,
        metadata: {
          guardianAccountId: guardian._id,
          guardianRelationship: guardianRelationship || "PARENT",
        },
      });
    }

    res.status(201).json(patient);
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
      .select("name email phone role nationalIdNumber hospital")
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
