import LabOrder from "../models/LabOrder.js";

export async function getLaboratorySummary({ hospital = {} } = {}) {
  const [pendingLabOrders, completedLabOrders, cancelledLabOrders] = await Promise.all([
    LabOrder.countDocuments({
      ...hospital,
      status: "Pending",
    }),
    LabOrder.countDocuments({
      ...hospital,
      status: "Completed",
    }),
    LabOrder.countDocuments({
      ...hospital,
      status: "Cancelled",
    }),
  ]);

  return {
    pendingLabOrders,
    completedLabOrders,
    cancelledLabOrders,
  };
}

export default getLaboratorySummary;
