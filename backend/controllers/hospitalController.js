import Hospital from "../models/Hospital.js";
import { v4 as uuidv4 } from "uuid";
import { cacheDel } from "../utils/cache.js";

/* ================= CREATE HOSPITAL ================= */

export const createHospital = async (req, res, next) => {
  try {
    const { name, address, contact, code } = req.body;

    const hospital = await Hospital.create({
      name,
      address,
      contact,
      code: code || "H-" + uuidv4().slice(0, 8),

      /* 🔐 DEFAULT FEATURE FLAGS ONBOARDING */
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

/* ================= FEATURE TOGGLES (SUPER_ADMIN) ================= */

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

export const updateHospitalFeatures = async (req, res, next) => {
  try {
    const { features } = req.body;

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { features },
      { new: true }
    );

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    /* 🧹 CLEAR MENU CACHE (per hospital) */
    await cacheDel(`menu:*:${hospital._id}`);

    res.json({
      message: "Hospital features updated",
      features: hospital.features,
    });
  } catch (err) {
    next(err);
  }
};
