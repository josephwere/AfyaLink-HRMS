import EvidenceAnchor from "../models/EvidenceAnchor.js";

export const enforceRetention = async () => {
  const now = new Date();

  await EvidenceAnchor.updateMany(
    {
      anchoredAt: {
        $lt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      },
    },
    { archived: true }
  );
};
