import { useEffect, useMemo, useState } from "react";
import { getRevenueDaily, getDoctorUtilization, getPharmacyProfit } from "../services/analyticsApi";
import { listTransfers } from "../services/transferApi";

export function useAnalyticsPage() {
  const [revenue, setRevenue] = useState([]);
  const [utilization, setUtilization] = useState([]);
  const [profit, setProfit] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState("");
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getRevenueDaily(), getDoctorUtilization(), getPharmacyProfit()])
      .then(([rev, util, prof]) => {
        if (!active) return;
        setRevenue(Array.isArray(rev) ? rev : []);
        setUtilization(Array.isArray(util) ? util : []);
        setProfit(Array.isArray(prof) ? prof : []);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load analytics");
      });

    listTransfers({ limit: 6, scope: "facility" })
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        if (!active) return;
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });

    return () => {
      active = false;
    };
  }, []);

  const revenueTotal = useMemo(() => revenue.reduce((sum, r) => sum + (r.total || 0), 0), [revenue]);
  const revenueMax = useMemo(() => Math.max(1, ...revenue.map((r) => r.total || 0)), [revenue]);
  const utilMax = useMemo(() => Math.max(1, ...utilization.map((u) => u.count || 0)), [utilization]);
  const profitMax = useMemo(() => Math.max(1, ...profit.map((p) => p.profit || 0)), [profit]);
  const pendingTransfers = transfers.filter((t) => t.status === "Pending").length;

  return {
    revenue,
    utilization,
    profit,
    transfers,
    error,
    transferError,
    revenueTotal,
    revenueMax,
    utilMax,
    profitMax,
    pendingTransfers,
  };
}

export default useAnalyticsPage;
