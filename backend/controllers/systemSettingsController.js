import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";
import { getIO } from "../utils/socket.js";

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
    updatedAt: doc?.updatedAt || null,
  });
};

export const updateSystemSettings = async (req, res) => {
  const { branding, ai, monetization, communications, clinical, governmentApis } = req.body || {};
  const doc = await getSystemSettingsDoc();

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
    const io = getIO();
    io.emit("system-settings:updated", {
      updatedAt: doc.updatedAt || new Date().toISOString(),
      brandingChanged: Boolean(branding),
      aiChanged: Boolean(ai),
      monetizationChanged: Boolean(monetization),
      communicationsChanged: Boolean(communications),
      clinicalChanged: Boolean(clinical),
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
