import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";
import { getIO } from "../utils/socket.js";
import { getEmailProviderInfo } from "../utils/mailer.js";
import { recordSettingsRevision } from "../services/settingsRevisionService.js";
import { persistSystemSettingsAssets } from "../services/settingsAssetService.js";
import { getObjectStorageStatus } from "../services/objectStorageService.js";
import SettingsRevision from "../models/SettingsRevision.js";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function maskEmail(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("@")) return raw || null;
  const [local, domain] = raw.split("@");
  if (!local || !domain) return raw;
  const visible = local.length <= 2 ? local[0] || "*" : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

export const getSystemSettings = async (_req, res) => {
  const doc = await getSystemSettingsDoc({ lean: true });
  res.set("Cache-Control", "no-store");
  res.json(doc);
};

export const getPublicBranding = async (_req, res) => {
  const doc = await getSystemSettingsDoc({ lean: true });
  res.set("Cache-Control", "no-store");

  return res.json({
    branding: doc?.branding || {},
    ai: {
      enabled: doc?.ai?.enabled !== false,
      icon: doc?.ai?.icon || "",
      name: doc?.ai?.name || "NeuroEdge",
      greeting: doc?.ai?.greeting || "Hi, how can I help?",
      url: doc?.ai?.url || "",
    },
    monetization: {
      featureAccess: {
        ai:
          doc?.monetization?.featureAccess?.get?.("ai") ||
          doc?.monetization?.featureAccess?.ai ||
          "FREE",
      },
    },
    patientSelfService: {
      defaultLanguage: doc?.patientSelfService?.defaultLanguage || "en",
      enabledLanguages: Array.isArray(doc?.patientSelfService?.enabledLanguages)
        ? doc.patientSelfService.enabledLanguages
        : ["en", "sw", "fr"],
      allowLanguageSwitch: doc?.patientSelfService?.allowLanguageSwitch !== false,
      voiceFirstIntake: doc?.patientSelfService?.voiceFirstIntake === true,
      whatsappSupport: doc?.patientSelfService?.whatsappSupport === true,
      helpLine: doc?.patientSelfService?.helpLine || "",
    },
    updatedAt: doc?.updatedAt || null,
  });
};

export const updateSystemSettings = async (req, res) => {
  let {
    branding,
    ai,
    monetization,
    communications,
    clinical,
    governmentApis,
    revenueCycle,
    patientSelfService,
    compliance,
  } = req.body || {};
  const doc = await getSystemSettingsDoc();

  ({ branding, ai } = await persistSystemSettingsAssets({ req, branding, ai }));

  if (branding) {
    if (branding.sidebarIcons) {
      const existing =
        doc.branding?.sidebarIcons?.toObject?.() ||
        doc.branding?.sidebarIcons ||
        {};
      doc.branding.sidebarIcons = { ...existing, ...branding.sidebarIcons };
    }
    const { sidebarIcons, ...restBranding } = branding;
    doc.branding = { ...doc.branding, ...restBranding, sidebarIcons: doc.branding.sidebarIcons };
  }
  if (ai) {
    const nextAi = { ...doc.ai, ...ai };
    if (Object.prototype.hasOwnProperty.call(ai, "enabled")) {
      nextAi.disabledByAdmin = ai.enabled === false;
    }
    doc.ai = nextAi;
  }
  if (monetization) {
    if (monetization.featureAccess) {
      const existing =
        doc.monetization?.featureAccess?.toObject?.() ||
        doc.monetization?.featureAccess ||
        {};
      doc.monetization.featureAccess = {
        ...existing,
        ...monetization.featureAccess,
      };
    }
    const { featureAccess, ...restMonetization } = monetization;
    doc.monetization = {
      ...doc.monetization,
      ...restMonetization,
      featureAccess: doc.monetization.featureAccess,
    };
  }
  if (communications) {
    doc.communications = { ...doc.communications, ...communications };
  }
  if (clinical) {
    doc.clinical = {
      ...doc.clinical,
      ...clinical,
      closeoutPolicy: {
        ...(doc.clinical?.closeoutPolicy || {}),
        ...(clinical.closeoutPolicy || {}),
      },
      familyAccess: {
        ...(doc.clinical?.familyAccess || {}),
        ...(clinical.familyAccess || {}),
        countryPolicies: {
          ...(doc.clinical?.familyAccess?.countryPolicies?.toObject?.() ||
            doc.clinical?.familyAccess?.countryPolicies ||
            {}),
          ...(clinical.familyAccess?.countryPolicies || {}),
        },
      },
    };
  }
  if (revenueCycle) {
    doc.revenueCycle = {
      ...doc.revenueCycle,
      ...revenueCycle,
    };
  }
  if (patientSelfService) {
    doc.patientSelfService = {
      ...doc.patientSelfService,
      ...patientSelfService,
      enabledLanguages: Array.isArray(patientSelfService.enabledLanguages)
        ? [...new Set(patientSelfService.enabledLanguages.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))]
        : doc.patientSelfService?.enabledLanguages || ["en", "sw", "fr"],
    };
  }
  if (compliance) {
    doc.compliance = {
      ...doc.compliance,
      ...compliance,
      privacyTemplates: {
        ...(doc.compliance?.privacyTemplates?.toObject?.() ||
          doc.compliance?.privacyTemplates ||
          {}),
        ...(compliance.privacyTemplates || {}),
      },
    };
  }
  if (governmentApis) {
    const existing = doc.governmentApis || {};
    doc.governmentApis = {
      ...existing,
      sha: {
        ...(existing.sha || {}),
        ...(governmentApis.sha || {}),
      },
      etims: {
        ...(existing.etims || {}),
        ...(governmentApis.etims || {}),
      },
    };
  }

  await doc.save();

  try {
    await recordSettingsRevision({
      scope: "SYSTEM",
      scopeId: doc.key || "GLOBAL",
      actorId: req.user?.id || req.user?._id || null,
      actorRole: req.user?.role || "",
      source: "system-settings",
      snapshot: doc.toObject({ flattenMaps: true }),
    });
  } catch {
    // Revision history should not block the main settings save path.
  }

  try {
    const io = getIO();
    io.emit("system-settings:updated", {
      updatedAt: doc.updatedAt || new Date().toISOString(),
      brandingChanged: Boolean(branding),
      aiChanged: Boolean(ai),
      monetizationChanged: Boolean(monetization),
      communicationsChanged: Boolean(communications),
      clinicalChanged: Boolean(clinical),
      revenueCycleChanged: Boolean(revenueCycle),
      patientSelfServiceChanged: Boolean(patientSelfService),
      complianceChanged: Boolean(compliance),
      governmentApisChanged: Boolean(governmentApis),
      actorId: req.user?.id || null,
      actorRole: req.user?.role || null,
    });
  } catch {
    // Socket server may not be initialized in lightweight/test environments.
  }

  res.set("Cache-Control", "no-store");
  res.json({ success: true, settings: doc });
};

function summarizeSystemSettingsRevision(revision) {
  const snapshot = revision?.snapshot || {};
  return {
    _id: revision?._id,
    createdAt: revision?.createdAt || null,
    actorRole: revision?.actorRole || "",
    source: revision?.source || "",
    sections: [
      snapshot.branding ? "branding" : null,
      snapshot.ai ? "ai" : null,
      snapshot.communications ? "communications" : null,
      snapshot.clinical ? "clinical" : null,
      snapshot.revenueCycle ? "revenueCycle" : null,
      snapshot.patientSelfService ? "patientSelfService" : null,
      snapshot.compliance ? "compliance" : null,
      snapshot.governmentApis ? "governmentApis" : null,
      snapshot.monetization ? "monetization" : null,
    ].filter(Boolean),
  };
}

export const getSystemSettingsHistory = async (_req, res) => {
  const revisions = await SettingsRevision.find({
    scope: "SYSTEM",
    scopeId: "GLOBAL",
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.set("Cache-Control", "no-store");
  res.json({
    items: revisions.map(summarizeSystemSettingsRevision),
  });
};

export const restoreSystemSettingsRevision = async (req, res) => {
  const revision = await SettingsRevision.findOne({
    _id: req.params.revisionId,
    scope: "SYSTEM",
    scopeId: "GLOBAL",
  }).lean();

  if (!revision?.snapshot) {
    return res.status(404).json({ message: "Settings revision not found" });
  }

  let snapshot = { ...revision.snapshot };
  const persistedAssets = await persistSystemSettingsAssets({
    req,
    branding: snapshot.branding,
    ai: snapshot.ai,
  });
  snapshot = {
    ...snapshot,
    branding: persistedAssets.branding,
    ai: persistedAssets.ai,
  };

  const doc = await getSystemSettingsDoc();
  doc.branding = snapshot.branding || {};
  doc.ai = snapshot.ai || {};
  doc.communications = snapshot.communications || {};
  doc.clinical = snapshot.clinical || {};
  doc.revenueCycle = snapshot.revenueCycle || {};
  doc.patientSelfService = snapshot.patientSelfService || {};
  doc.compliance = snapshot.compliance || {};
  doc.governmentApis = snapshot.governmentApis || {};
  doc.monetization = snapshot.monetization || {};
  doc.migrations = snapshot.migrations || {};
  await doc.save();

  try {
    await recordSettingsRevision({
      scope: "SYSTEM",
      scopeId: doc.key || "GLOBAL",
      actorId: req.user?.id || req.user?._id || null,
      actorRole: req.user?.role || "",
      source: `system-settings-restore:${req.params.revisionId}`,
      snapshot: doc.toObject({ flattenMaps: true }),
    });
  } catch {
    // Revision history should not block restore.
  }

  try {
    const io = getIO();
    io.emit("system-settings:updated", {
      updatedAt: doc.updatedAt || new Date().toISOString(),
      restoreRevisionId: req.params.revisionId,
      actorId: req.user?.id || null,
      actorRole: req.user?.role || null,
      restored: true,
    });
  } catch {
    // ignore socket issues
  }

  res.set("Cache-Control", "no-store");
  return res.json({
    success: true,
    restoredRevisionId: req.params.revisionId,
    settings: doc,
  });
};

export const getEmailDeliveryHealth = async (_req, res) => {
  const providerInfo = getEmailProviderInfo();
  const brevoConfigured = Boolean(process.env.BREVO_API_KEY);
  const smtpConfigured = Boolean(
    (process.env.SMTP_USER || process.env.EMAIL_USER) &&
      (process.env.SMTP_PASS || process.env.EMAIL_PASS) &&
      (process.env.SMTP_HOST || process.env.EMAIL_USER)
  );
  const sendGridConfigured = Boolean(process.env.SENDGRID_API_KEY);
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    "";
  const brevoDefaultLists = splitCsv(process.env.BREVO_CONTACT_LIST_IDS).map((item) => Number(item)).filter(Number.isFinite);
  const missing = [];

  if (!senderEmail) missing.push("Verified sender email");
  if (!brevoConfigured && !smtpConfigured && !sendGridConfigured) {
    missing.push("At least one email provider");
  }
  if (providerInfo.provider === "brevo" && !brevoConfigured) {
    missing.push("BREVO_API_KEY");
  }
  if (providerInfo.provider === "smtp" && !smtpConfigured) {
    missing.push("SMTP credentials");
  }

  const status = missing.length ? "warning" : "healthy";

  res.set("Cache-Control", "no-store");
  res.json({
    status,
    provider: providerInfo.provider,
    providerConfigured: providerInfo.configured,
    sender: {
      name: providerInfo.sender?.name || "AfyaLink HRMS",
      emailMasked: maskEmail(providerInfo.sender?.email || senderEmail),
    },
    brevo: {
      apiConfigured: brevoConfigured,
      contactSyncEnabled: brevoConfigured,
      defaultListIds: brevoDefaultLists,
      smokeScript: "npm run smoke:brevo-email",
      smokeSandboxDefault: String(process.env.BREVO_SMOKE_SANDBOX || "1").trim() !== "0",
    },
    smtp: {
      configured: smtpConfigured,
      host: process.env.SMTP_HOST || (process.env.EMAIL_USER ? "smtp.gmail.com" : ""),
      port: Number(process.env.SMTP_PORT || 587),
      secure:
        String(process.env.SMTP_SECURE || "").trim() !== ""
          ? String(process.env.SMTP_SECURE).trim() === "true"
          : Number(process.env.SMTP_PORT || 587) === 465,
      loginMasked: maskEmail(process.env.SMTP_USER || process.env.EMAIL_USER),
    },
    sendgrid: {
      configured: sendGridConfigured,
    },
    recommendations: missing,
    checkedAt: new Date().toISOString(),
  });
};

export const getAssetDeliveryHealth = async (_req, res) => {
  const storage = getObjectStorageStatus();

  res.set("Cache-Control", "no-store");
  res.json({
    status: storage.configured ? "healthy" : "warning",
    provider: storage.provider,
    configured: storage.configured,
    publicBaseUrl: storage.publicBaseUrl || "",
    recommendations:
      storage.provider === "local"
        ? [
            "Local asset storage is active. Configure Cloudinary for globally cached CDN delivery and cross-redeploy durability.",
          ]
        : storage.configured
          ? []
          : [
              "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable CDN-backed branding delivery.",
            ],
    checkedAt: new Date().toISOString(),
  });
};
