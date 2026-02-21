import Hospital from "../models/Hospital.js";
import AuditLog from "../models/AuditLog.js";

function resolveHospitalId(req) {
  const role = String(req.user?.role || "").toUpperCase();
  const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  if (privileged) {
    return req.query?.hospitalId || req.body?.hospitalId || req.user?.hospital;
  }
  return req.user?.hospital;
}

/* ======================================================
   GET HOSPITAL FEATURES, LIMITS & EMERGENCY STATE
   - tenant-safe
   - soft-delete safe
   - break-glass transparent (NON-OPTIONAL)
====================================================== */
export const getHospitalConfig = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const hospital = await Hospital.findById(hospitalId).select(
      "name plan features limits active subscription insuranceProviders patientPaymentMethods customization"
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
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }
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

/* ======================================================
   UPDATE HOSPITAL PAYMENT + INSURANCE CONFIG
====================================================== */
export const updateHospitalCommerceConfig = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }
    const { insuranceProviders, patientPaymentMethods } = req.body || {};

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }
    if (hospital.active === false) {
      return res.status(403).json({ message: "Cannot update deactivated hospital" });
    }

    if (Array.isArray(insuranceProviders)) {
      hospital.insuranceProviders = insuranceProviders
        .map((row) => ({
          code: String(row?.code || "").trim().toUpperCase(),
          name: String(row?.name || "").trim(),
          country: String(row?.country || "").trim().toUpperCase(),
          enabled: row?.enabled !== false,
          metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
        }))
        .filter((row) => row.code && row.name);
    }

    if (Array.isArray(patientPaymentMethods)) {
      hospital.patientPaymentMethods = patientPaymentMethods
        .map((row) => ({
          type: String(row?.type || "").trim().toUpperCase(),
          label: String(row?.label || "").trim(),
          accountName: String(row?.accountName || "").trim(),
          accountNumber: String(row?.accountNumber || "").trim(),
          paybill: String(row?.paybill || "").trim(),
          tillNumber: String(row?.tillNumber || "").trim(),
          phone: String(row?.phone || "").trim(),
          email: String(row?.email || "").trim(),
          instructions: String(row?.instructions || "").trim(),
          enabled: row?.enabled !== false,
        }))
        .filter((row) => row.type && row.label);
    }

    await hospital.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "UPDATE_HOSPITAL_COMMERCE_CONFIG",
      resource: "Hospital",
      resourceId: hospital._id,
      hospital: hospital._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      insuranceProviders: hospital.insuranceProviders || [],
      patientPaymentMethods: hospital.patientPaymentMethods || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update hospital payment/insurance config" });
  }
};

/* ======================================================
   UPDATE HOSPITAL CUSTOMIZATION
====================================================== */
export const updateHospitalCustomization = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }
    const payload = req.body?.customization || {};

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }
    if (hospital.active === false) {
      return res.status(403).json({ message: "Cannot customize deactivated hospital" });
    }

    const current = hospital.customization?.toObject?.() || hospital.customization || {};
    const next = {
      ...current,
      ...payload,
      branding: {
        ...(current.branding || {}),
        ...(payload.branding || {}),
      },
      theme: {
        ...(current.theme || {}),
        ...(payload.theme || {}),
      },
      modules: {
        ...(current.modules || {}),
        ...(payload.modules || {}),
      },
      updatedBy: req.user._id,
      updatedAt: new Date(),
    };
    hospital.customization = next;
    await hospital.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "UPDATE_HOSPITAL_CUSTOMIZATION",
      resource: "Hospital",
      resourceId: hospital._id,
      hospital: hospital._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      customization: hospital.customization || {},
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update hospital customization" });
  }
};
