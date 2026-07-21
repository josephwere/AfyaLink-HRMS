import PharmacyItem from "../models/PharmacyItem.js";
import Prescription from "../models/Prescription.js";

export async function getPharmacySummary({ hospital = {} } = {}) {
  const [pendingPrescriptions, lowStockItems, outOfStockItems] = await Promise.all([
    Prescription.countDocuments({
      ...hospital,
      status: { $in: ["CREATED", "DISPENSED"] },
    }),
    PharmacyItem.countDocuments({
      ...hospital,
      active: true,
      totalQuantity: { $gt: 0, $lte: 10 },
    }),
    PharmacyItem.countDocuments({
      ...hospital,
      active: true,
      totalQuantity: { $lte: 0 },
    }),
  ]);

  return {
    pendingPrescriptions,
    lowStockItems,
    outOfStockItems,
  };
}

export default getPharmacySummary;
