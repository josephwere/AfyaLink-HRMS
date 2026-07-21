import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDialysisOpsDashboard,
  getEmergencyCommandDashboard,
  getIcuOpsDashboard,
  getImagingOpsDashboard,
  getNeonatalIcuDashboard,
  getOncologyDaycareDashboard,
  getTheatreOpsDashboard,
  getTriageOpsDashboard,
} from "../services/dashboardApi";
import { listTransfers as defaultListTransfers } from "../services/transferApi";

const dashboardLoaders = {
  dialysis: getDialysisOpsDashboard,
  emergencyCommand: getEmergencyCommandDashboard,
  icu: getIcuOpsDashboard,
  imaging: getImagingOpsDashboard,
  neonatalIcu: getNeonatalIcuDashboard,
  oncologyDaycare: getOncologyDaycareDashboard,
  theatre: getTheatreOpsDashboard,
  triage: getTriageOpsDashboard,
};

export function useOperationsDashboard({ dashboardType, loadDashboard, loadTransfers }) {
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const resolvedDashboardLoader = loadDashboard || dashboardLoaders[dashboardType] || null;
  const resolvedTransferLoader = loadTransfers || defaultListTransfers;

  const load = useCallback(async () => {
    if (resolvedDashboardLoader) {
      try {
        const dashboardData = await resolvedDashboardLoader();
        setData(dashboardData || null);
      } catch {
        setData(null);
      }
    } else {
      setData(null);
    }

    try {
      const response = await resolvedTransferLoader({ limit: 6, scope: "facility" });
      const items = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Unable to load transfers.");
    }
  }, [resolvedDashboardLoader, resolvedTransferLoader]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingTransfers = useMemo(
    () => transfers.filter((t) => String(t?.status || "").toUpperCase() === "PENDING").length,
    [transfers]
  );

  return { data, transfers, transferError, pendingTransfers, reload: load };
}

export default useOperationsDashboard;
