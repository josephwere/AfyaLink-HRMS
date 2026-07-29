import Hospital from "../models/Hospital.js";
import AuditLog from "../models/AuditLog.js";
import { recordSettingsRevision } from "../services/settingsRevisionService.js";
import { persistHospitalCustomizationAssets } from "../services/settingsAssetService.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { notifyUsers } from "../services/notificationService.js";
import SettingsRevision from "../models/SettingsRevision.js";
import { normalizeSchedulingPolicy } from "../utils/schedulingPolicy.js";

function resolveHospitalId(req) {
  const role = String(req.user?.role || "").toUpperCase();
  const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  if (privileged) {
    return req.query?.hospitalId || req.body?.hospitalId || req.user?.hospital;
  }
  return req.user?.hospital;
}

async function getPharmacyCoverageStats(hospitalId) {
  const [pharmacists, linkedPharmacists] = await Promise.all([
    User.countDocuments({
      hospital: hospitalId,
      role: "PHARMACIST",
      active: true,
    }),
    User.countDocuments({
      hospital: hospitalId,
      role: "PHARMACIST",
      active: true,
      registeredPharmacy: { $ne: null },
    }),
  ]);
  return {
    pharmacists,
    linkedPharmacists,
    unlinkedPharmacists: Math.max(0, pharmacists - linkedPharmacists),
  };
}

async function notifyPharmacyCoverageRisk({ hospital, actorId }) {
  const recipients = await User.find({
    hospital: hospital._id,
    role: "HOSPITAL_ADMIN",
    active: true,
  })
    .select("_id")
    .lean();

  const recipientIds = recipients.map((row) => String(row._id));
  if (actorId && !recipientIds.includes(String(actorId))) {
    recipientIds.push(String(actorId));
  }

  if (!recipientIds.length) return;

  const existing = await Notification.findOne({
    hospital: hospital._id,
    category: "PHARMACY",
    "meta.type": "PHARMACY_COVERAGE_RISK",
    read: false,
  })
    .select("_id")
    .lean();

  if (existing) return;

  await notifyUsers({
    users: recipientIds,
    hospital: hospital._id,
    category: "PHARMACY",
    title: "Pharmacy Coverage Risk",
    body: "Pharmacy is enabled, but no pharmacist is linked to a registered pharmacy yet.",
    meta: {
      type: "PHARMACY_COVERAGE_RISK",
      path: "/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist",
    },
  });
}

/* ======================================================
   GET HOSPITAL FEATURES, LIMITS & EMERGENCY STATE
   - tenant-safe
   - soft-delete safe
   - break-glass transparent (NON-OPTIONAL)
====================================================== */
export const getHospitalConfig = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      if (privileged) {
        return res.json({
          name: null,
          plan: "FREE",
          features: {},
          limits: {},
          active: true,
          subscription: null,
          insuranceProviders: [],
          patientPaymentMethods: [],
          schedulingPolicy: normalizeSchedulingPolicy(),
          customization: {},
          needsHospitalSelection: true,
          breakGlassActive: req.breakGlass || false,
          breakGlassExpiresAt: req.breakGlassExpiresAt || null,
        });
      }
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const hospital = await Hospital.findById(hospitalId).select(
      "name plan features limits active subscription insuranceProviders patientPaymentMethods schedulingPolicy customization"
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
      schedulingPolicy: normalizeSchedulingPolicy(hospital.schedulingPolicy?.toObject?.() || hospital.schedulingPolicy || {}),
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
   HOSPITAL SCHEDULING POLICY
====================================================== */
export const getHospitalSchedulingPolicy = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const hospital = await Hospital.findById(hospitalId).select("name active schedulingPolicy");
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }
    if (hospital.active === false) {
      return res.status(403).json({ message: "Cannot load policy for deactivated hospital" });
    }

    return res.json({
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      policy: normalizeSchedulingPolicy(hospital.schedulingPolicy?.toObject?.() || hospital.schedulingPolicy || {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load hospital scheduling policy" });
  }
};

export const updateHospitalSchedulingPolicy = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }
    if (hospital.active === false) {
      return res.status(403).json({ message: "Cannot update policy for deactivated hospital" });
    }

    const before = normalizeSchedulingPolicy(hospital.schedulingPolicy?.toObject?.() || hospital.schedulingPolicy || {});
    const after = normalizeSchedulingPolicy(req.body?.policy || req.body || {}, before);
    hospital.schedulingPolicy = {
      ...after,
      updatedBy: req.user?._id || null,
      updatedAt: new Date(),
    };
    await hospital.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "UPDATE_HOSPITAL_SCHEDULING_POLICY",
      resource: "Hospital",
      resourceId: hospital._id,
      hospital: hospital._id,
      before,
      after,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      hospitalId: hospital._id,
      policy: normalizeSchedulingPolicy(hospital.schedulingPolicy?.toObject?.() || hospital.schedulingPolicy || {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update hospital scheduling policy" });
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
    const coverageBefore = await getPharmacyCoverageStats(hospital._id);
    const riskBefore = Boolean(before?.pharmacy) && coverageBefore.pharmacists > 0 && coverageBefore.linkedPharmacists === 0;

    /* 🔐 UPDATE ONLY KNOWN FEATURES */
    Object.keys(updates).forEach((key) => {
      if (key in hospital.features) {
        hospital.features[key] = updates[key];
      }
    });

    await hospital.save();

    const coverageAfter = coverageBefore;
    const riskAfter =
      Boolean(hospital.features?.pharmacy) &&
      coverageAfter.pharmacists > 0 &&
      coverageAfter.linkedPharmacists === 0;

    if (!riskBefore && riskAfter) {
      await notifyPharmacyCoverageRisk({
        hospital,
        actorId: req.user?._id || null,
      });
    }

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
    const rawPayload = req.body?.customization || {};

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }
    if (hospital.active === false) {
      return res.status(403).json({ message: "Cannot customize deactivated hospital" });
    }

    const payload = await persistHospitalCustomizationAssets({
      req,
      hospitalId: hospital._id,
      customizationPatch: rawPayload,
    });

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
      clinical: {
        ...(current.clinical || {}),
        ...(payload.clinical || {}),
        closeoutPolicy: {
          ...(current.clinical?.closeoutPolicy || {}),
          ...(payload.clinical?.closeoutPolicy || {}),
        },
      },
      updatedBy: req.user._id,
      updatedAt: new Date(),
    };
    hospital.customization = next;
    await hospital.save();

    try {
      await recordSettingsRevision({
        scope: "HOSPITAL",
        scopeId: String(hospital._id),
        hospitalId: hospital._id,
        actorId: req.user?._id || null,
        actorRole: req.user?.role || "",
        source: "hospital-customization",
        snapshot: {
          customization: hospital.customization?.toObject?.() || hospital.customization || {},
          branding: hospital.customization?.branding || {},
          theme: hospital.customization?.theme || {},
          modules: hospital.customization?.modules || {},
          clinical: hospital.customization?.clinical || {},
          updatedAt: hospital.customization?.updatedAt || new Date(),
        },
      });
    } catch {
      // Revision history should not block the main customization save path.
    }

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

function summarizeHospitalCustomizationRevision(revision) {
  const snapshot = revision?.snapshot || {};
  return {
    _id: revision?._id,
    createdAt: revision?.createdAt || null,
    actorRole: revision?.actorRole || "",
    source: revision?.source || "",
    sections: [
      snapshot.branding ? "branding" : null,
      snapshot.theme ? "theme" : null,
      snapshot.modules ? "modules" : null,
      snapshot.clinical ? "clinical" : null,
    ].filter(Boolean),
  };
}

export const getHospitalCustomizationHistory = async (req, res) => {
  const hospitalId = resolveHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "hospitalId is required for this role" });
  }

  const revisions = await SettingsRevision.find({
    scope: "HOSPITAL",
    scopeId: String(hospitalId),
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return res.json({
    items: revisions.map(summarizeHospitalCustomizationRevision),
  });
};

export const restoreHospitalCustomizationRevision = async (req, res) => {
  const hospitalId = resolveHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "hospitalId is required for this role" });
  }

  const revision = await SettingsRevision.findOne({
    _id: req.params.revisionId,
    scope: "HOSPITAL",
    scopeId: String(hospitalId),
  }).lean();

  if (!revision?.snapshot) {
    return res.status(404).json({ message: "Customization revision not found" });
  }

  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found" });
  }

  const restoredCustomization = await persistHospitalCustomizationAssets({
    req,
    hospitalId: hospital._id,
    customizationPatch: revision.snapshot.customization || revision.snapshot,
  });

  hospital.customization = {
    ...(restoredCustomization || {}),
    updatedBy: req.user?._id || hospital.customization?.updatedBy,
    updatedAt: new Date(),
  };
  await hospital.save();

  try {
    await recordSettingsRevision({
      scope: "HOSPITAL",
      scopeId: String(hospital._id),
      hospitalId: hospital._id,
      actorId: req.user?._id || null,
      actorRole: req.user?.role || "",
      source: `hospital-customization-restore:${req.params.revisionId}`,
      snapshot: {
        customization: hospital.customization?.toObject?.() || hospital.customization || {},
        branding: hospital.customization?.branding || {},
        theme: hospital.customization?.theme || {},
        modules: hospital.customization?.modules || {},
        clinical: hospital.customization?.clinical || {},
        updatedAt: hospital.customization?.updatedAt || new Date(),
      },
    });
  } catch {
    // ignore revision errors during restore
  }

  await AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "RESTORE_HOSPITAL_CUSTOMIZATION",
    resource: "Hospital",
    resourceId: hospital._id,
    hospital: hospital._id,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.json({
    success: true,
    restoredRevisionId: req.params.revisionId,
    customization: hospital.customization || {},
  });
};
