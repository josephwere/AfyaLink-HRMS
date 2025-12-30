import Patient from "../models/Patient.js";
import Hospital from "../models/Hospital.js";
import { denyAudit } from "../middleware/denyAudit.js";
import { audit } from "../utils/audit.js";

/**
 * CREATE PATIENT
 * ✔ Hospital enforced from logged-in user
 * ✔ Patient limit enforced
 * ✔ Soft-delete safe
 */
export const createPatient = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospitalId;

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

    /* ================= CREATE PATIENT ================= */
    const patient = await Patient.create({
      ...req.body,
      hospital: hospitalId, // 🔐 tenant enforced
      createdBy: req.user._id,
      active: true,
    });

    res.status(201).json(patient);
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

    const patients = await Patient.find({
      hospital: req.user.hospitalId, // 🔐 tenant scoped
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
