import SystemSettings from "../models/SystemSettings.js";

export const getSystemSettings = async (_req, res) => {
  let doc = await SystemSettings.findOne().lean();
  if (!doc) {
    doc = await SystemSettings.create({});
  }
  res.json(doc);
};

export const updateSystemSettings = async (req, res) => {
  const { branding, ai } = req.body || {};
  let doc = await SystemSettings.findOne();
  if (!doc) doc = await SystemSettings.create({});

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

  await doc.save();
  res.json({ success: true, settings: doc });
};
