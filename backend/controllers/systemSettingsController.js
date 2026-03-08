import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

export const getSystemSettings = async (_req, res) => {
  const doc = await getSystemSettingsDoc({ lean: true });
  res.json(doc);
};

export const getPublicBranding = async (_req, res) => {
  const doc = await getSystemSettingsDoc({ lean: true });

  return res.json({
    branding: doc?.branding || {},
  });
};

export const updateSystemSettings = async (req, res) => {
  const { branding, ai, monetization, communications } = req.body || {};
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
    doc.ai = { ...doc.ai, ...ai };
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

  await doc.save();
  res.json({ success: true, settings: doc });
};
