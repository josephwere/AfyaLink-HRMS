import AccessEntry from "../models/AccessEntry.js";

export const syncOfflineData = async (req, res) => {
  try {
    const hospital = req.user.hospital;

    /* Last 24 hours valid access */
    const accessList = await AccessEntry.find({
      hospital,
      expiresAt: { $gt: new Date() },
      status: "ACTIVE",
    })
      .select("code expiresAt areasAllowed personType")
      .lean();

    res.json({
      syncedAt: new Date(),
      count: accessList.length,
      accessList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
