import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSuperAdminDashboard } from "../services/dashboardApi";
import { getDeveloperOverview } from "../services/developerApi";
import { listTrainingTrackers } from "../services/trainingTrackerApi";
import { listTransfers } from "../services/transferApi";
import { guardedConsoleFetch } from "../services/guardedConsoleFetch";

export function useSuperAdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ops, setOps] = useState(null);
  const [training, setTraining] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [unlinkedPharmacists, setUnlinkedPharmacists] = useState(0);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getSuperAdminDashboard().then(setData).catch(() => setData(null));
    getDeveloperOverview().then(setOps).catch(() => setOps(null));
    guardedConsoleFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500", {
      warmupKey: "super-admin-unlinked-pharmacists",
    })
      .then((result) => {
        const res = result?.payload || {};
        const rows = Array.isArray(res?.items) ? res.items : [];
        setUnlinkedPharmacists(rows.length);
      })
      .catch(() => setUnlinkedPharmacists(0));
    listTrainingTrackers({ limit: 300 })
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
        setTraining({ total, notStarted, inProgress, completed, overdueNotStarted, overdueInProgress, completionRate });
      })
      .catch(() => setTraining({ total: 0, notStarted: 0, inProgress: 0, completed: 0, overdueNotStarted: 0, overdueInProgress: 0, completionRate: 0 }));
    listTransfers({ limit: 10, scope: "global" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
  }, []);

  const pendingTransfers = useMemo(() => transfers.filter((t) => t.status === "Pending").length, [transfers]);

  return {
    navigate,
    data,
    ops,
    training,
    unlinkedPharmacists,
    transfers,
    transferError,
    pendingTransfers,
  };
}

export default useSuperAdminDashboard;
