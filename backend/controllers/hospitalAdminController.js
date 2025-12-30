import Hospital from "../models/Hospital.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   GET HOSPITAL FEATURES & LIMITS
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

    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: "Failed to load hospital config" });
  }
};

/* ======================================================
   UPDATE FEATURE TOGGLES (AUDIT SAFE)
====================================================== */
export const updateHospitalFeatures = async (req, res) => {
  try {
    const hospitalId = req.user.hospital;
    const updates = req.body.features;

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

    // Update only known feature keys
    Object.keys(updates).forEach((key) => {
      if (key in hospital.features) {
        hospital.features[key] = updates[key];
      }
    });

    await hospital.save();

    /* ================= AUDIT LOG ================= */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "UPDATE_HOSPITAL_FEATURES",
      resource: "Hospital",
      resourceId: hospital._id,
      before,
      after: hospital.features,
      hospital: hospital._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: "Features updated successfully",
      features: hospital.features,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update features" });
  }
};
