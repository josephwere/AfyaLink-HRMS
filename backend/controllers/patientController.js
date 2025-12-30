import Patient from "../models/Patient.js";
import { denyAudit } from "../middleware/denyAudit.js";

/**
 * CREATE PATIENT
 * Hospital is forced from logged-in user
 */
export const createPatient = async (req, res, next) => {
  try {
    const patient = await Patient.create({
      ...req.body,
      hospital: req.user.hospitalId, // 🔐 enforce tenant
      createdBy: req.user._id,
    });

    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
};

/**
 * GET SINGLE PATIENT
 * Tenant isolation + audit on deny
 */
export const getPatient = async (req, res, next) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findById(id).populate(
      "hospital primaryDoctor medicalRecords"
    );

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
 * Always scoped to hospital
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
