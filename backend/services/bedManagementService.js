import Bed from "../models/Bed.js";

export async function getBedManagementSummary({ hospital = {} } = {}) {
  const beds = await Bed.find(hospital).select("ward occupied").lean();

  const occupiedBeds = beds.filter((row) => row.occupied).length;
  const availableBeds = Math.max(0, beds.length - occupiedBeds);
  const bedOccupancyRate = beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0;

  const wardOccupancy = Array.from(
    beds.reduce((acc, bed) => {
      const key = bed.ward || "Unassigned";
      const row = acc.get(key) || { ward: key, total: 0, occupied: 0 };
      row.total += 1;
      if (bed.occupied) row.occupied += 1;
      acc.set(key, row);
      return acc;
    }, new Map()).values()
  )
    .map((row) => ({
      ...row,
      available: Math.max(0, row.total - row.occupied),
      occupancyRate: row.total ? Math.round((row.occupied / row.total) * 100) : 0,
    }))
    .sort((a, b) => b.occupancyRate - a.occupancyRate || a.ward.localeCompare(b.ward));

  return {
    totalBeds: beds.length,
    occupiedBeds,
    availableBeds,
    bedOccupancyRate,
    wardOccupancy,
  };
}

export default getBedManagementSummary;
