import Hospital from "../models/Hospital.js";
import { v4 as uuidv4 } from "uuid";
import { cacheDel } from "../utils/cache.js";
import { diffObjects } from "../utils/diff.js";
import { audit } from "../utils/audit.js";

/* ================= CREATE HOSPITAL ================= */

export const createHospital = async (req, res, next) => {
  try {
    const { name, address, contact, code } = req.body;

    const hospital = await Hospital.create({
      name,
      address,
      contact,
      code: code || "H-" + uuidv4().slice(0, 8),

      /* 🔐 DEFAULT FEATURE FLAGS (ONBOARDING SAFE) */
      features: {
        ai: false,
        payments: false,
        pharmacy: false,
        inventory: false,
        lab: false,
        realtime: false,
        auditLogs: false,
        adminCreation: false,
      },
    });

    res.json(hospital);
  } catch (err) {
    next(err);
  }
};

/* ================= LIST HOSPITALS ================= */

export const listHospitals = async (req, res, next) => {
  try {
    const hospitals = await Hospital.find();
    res.json(hospitals);
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
