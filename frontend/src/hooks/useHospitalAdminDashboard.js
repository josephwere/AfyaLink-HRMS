import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import { getExecutiveDashboard, getHospitalAdminDashboard } from "../services/dashboardApi";
import { runStaffingForecast } from "../services/mlApi";
import { listTrainingTrackers } from "../services/trainingTrackerApi";
import { listTransfers } from "../services/transferApi";
import { guardedConsoleFetch } from "../services/guardedConsoleFetch";

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function useHospitalAdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [executiveData, setExecutiveData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [machineStats, setMachineStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    maintenance: 0,
  });
  const [trainingStats, setTrainingStats] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const loadForecast = useCallback(async () => {
    try {
      const r = await runStaffingForecast({
        beds: 180,
        occupancyRate: 0.76,
        avgPatientsPerDoctor: 12,
        avgPatientsPerNurse: 5,
        horizonDays: 7,
      });
      setForecast(r || null);
    } catch {
      setForecast(null);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [hospitalData, executive, forecastData] = await Promise.all([
        getHospitalAdminDashboard(),
        getExecutiveDashboard(),
        loadForecast(),
      ]);
      setData(hospitalData || null);
      setExecutiveData(executive || null);
      setForecast(forecastData || null);
    } catch {
      setData(null);
      setExecutiveData(null);
      setForecast(null);
    }
  }, [loadForecast]);

  useEffect(() => {
    void loadDashboard();

    listTrainingTrackers({ hospital: user?.hospital || undefined, limit: 200 })
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        const now = Date.now();
        const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
        const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
        const completed = rows.filter((r) => r.status === "COMPLETED").length;
        const overdueNotStarted = rows.filter(
          (r) => r.status === "NOT_STARTED" && r.createdAt && now - new Date(r.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
        ).length;
        const overdueInProgress = rows.filter(
          (r) => r.status === "IN_PROGRESS" && r.updatedAt && now - new Date(r.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
        ).length;
        const total = rows.length;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        setTrainingStats({ total, notStarted, inProgress, completed, overdueNotStarted, overdueInProgress, completionRate });
      })
      .catch(() => {
        setTrainingStats({ total: 0, notStarted: 0, inProgress: 0, completed: 0, overdueNotStarted: 0, overdueInProgress: 0, completionRate: 0 });
      });

    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });

    guardedConsoleFetch("/api/machine-connectivity/devices", { warmupKey: "hospital-admin-machine-connectivity" })
      .then((result) => {
        const rows = Array.isArray(result?.payload?.items) ? result.payload.items : [];
        setMachineStats({
          total: rows.length,
          online: rows.filter((d) => d.status === "ONLINE").length,
          offline: rows.filter((d) => d.status === "OFFLINE").length,
          error: rows.filter((d) => d.status === "ERROR").length,
          maintenance: rows.filter((d) => d.status === "MAINTENANCE").length,
        });
      })
      .catch(() => {
        setMachineStats({ total: 0, online: 0, offline: 0, error: 0, maintenance: 0 });
      });

    const timer = setInterval(() => {
      void loadForecast();
    }, 45000);
    return () => clearInterval(timer);
  }, [loadDashboard, loadForecast, user?.hospital]);

  const pendingTransfers = useMemo(() => transfers.filter((t) => t.status === "Pending").length, [transfers]);
  const overdueLearning = trainingStats.overdueNotStarted + trainingStats.overdueInProgress;
  const machineAlerts = machineStats.offline + machineStats.error;
  const pharmacyRiskStatus = data?.pharmacyCoverageRisk ? "Active risk" : "Clear";
  const pharmacyRiskTone = data?.pharmacyCoverageRisk ? "risk" : "good";
  const staffRiskCount = clampNumber(data?.incompleteStaff) + clampNumber(data?.inactiveStaff) + clampNumber(data?.missingLicenses);
  const wardOccupancyRows = Array.isArray(data?.wardOccupancy) ? data.wardOccupancy.slice(0, 5) : [];
  const executiveWidgetData = useMemo(
    () => ({
      bedOccupancy: executiveData?.bedOccupancyRate != null ? `${executiveData.bedOccupancyRate}%` : data?.bedOccupancyRate ? `${data.bedOccupancyRate}%` : "—",
      occupiedBeds: executiveData?.occupiedBeds ?? data?.occupiedBeds ?? 0,
      totalBeds: executiveData?.totalBeds ?? data?.totalBeds ?? 0,
      admissionsToday: executiveData?.admissionsToday ?? data?.admissionsToday ?? 0,
      dischargesToday: executiveData?.dischargesToday ?? data?.dischargesToday ?? 0,
      revenueToday: executiveData?.revenueToday ?? data?.revenueToday ?? "$0",
      pendingClaims: executiveData?.pendingClaims ?? data?.pendingClaims ?? 0,
      pharmacyAlerts: executiveData?.pharmacyCoverageRisk ? 1 : data?.pharmacyCoverageRisk ? 1 : 0,
      laboratoryQueue: executiveData?.laboratoryQueue ?? data?.laboratoryQueue ?? 0,
      radiologyQueue: executiveData?.radiologyQueue ?? data?.radiologyQueue ?? 0,
      staffOnDuty: executiveData?.staffOnDuty ?? data?.staffOnDuty ?? 0,
      activeOverrides: executiveData?.activeOverrides ?? data?.activeOverrides ?? 0,
      machineOffline: machineStats.offline,
      auditAlerts: executiveData?.auditAlerts ?? data?.auditAlerts ?? 0,
    }),
    [data, executiveData, machineStats.offline]
  );

  return {
    data,
    executiveData,
    forecast,
    machineStats,
    trainingStats,
    transfers,
    transferError,
    pendingTransfers,
    overdueLearning,
    machineAlerts,
    pharmacyRiskStatus,
    pharmacyRiskTone,
    staffRiskCount,
    wardOccupancyRows,
    executiveWidgetData,
    loadDashboard,
    loadForecast,
  };
}

export default useHospitalAdminDashboard;
