import Hospital from "../models/Hospital.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   GET HOSPITAL FEATURES, LIMITS & EMERGENCY STATE
   - tenant-safe
   - soft-delete safe
   - break-glass transparent (NON-OPTIONAL)
====================================================== */
export const getHospitalConfig = async (req, res) => {
  try {
    const hospitalId = req.user.hospital;

    const hospital = await Hospital.findById(hospitalId).select(
      "name plan features limits active"
    );

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    /* 🔒 SOFT-DELETE GUARD */
    if (hospital.active === false) {
      return res.status(403).json({
        message: "Hospital is deactivated",
      });
    }

    res.json({
      ...hospital.toObject(),
      /* 🚨 EMERGENCY BREAK-GLASS TRANSPARENCY */
      breakGlassActive: req.breakGlass || false,
      breakGlassExpiresAt: req.breakGlassExpiresAt || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load hospital config",
    });
  }
};

/* ======================================================
   UPDATE FEATURE TOGGLES (AUDIT SAFE)
   - no overwrite of unknown flags
   - soft-delete guarded
   - fully auditable
====================================================== */
export const updateHospitalFeatures = async (req, res) => {
  try {
    const hospitalId = req.user.hospital;
    const updates = req.body.features || {};

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    /* 🔒 SOFT-DELETE GUARD */
    if (hospital.active === false) {
      return res.status(403).json({
        message: "Cannot update features for deactivated hospital",
      });
    }

    const before = { ...hospital.features };

    /* 🔐 UPDATE ONLY KNOWN FEATURES */
    Object.keys(updates).forEach((key) => {
      if (key in hospital.features) {
        hospital.features[key] = updates[key];
      }
    });

    await hospital.save();

    /* 🧾 AUDIT LOG (FORENSIC-GRADE) */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "UPDATE_HOSPITAL_FEATURES",
      resource: "Hospital",
      resourceId: hospital._id,
      hospital: hospital._id,
      before,
      after: hospital.features,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: "Features updated successfully",
      features: hospital.features,
      /* 🚨 ALWAYS RETURN EMERGENCY STATE */
      breakGlassActive: req.breakGlass || false,
      breakGlassExpiresAt: req.breakGlassExpiresAt || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to update features",
    });
  }
};
