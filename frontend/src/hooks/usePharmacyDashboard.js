import { useEffect, useMemo, useState } from "react";
import pharmacyService from "../services/pharmacy";

export function usePharmacyDashboard({ limit = 25 } = {}) {
  const [items, setItems] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [inventoryRes, prescriptionRes, transferRes] = await Promise.all([
          pharmacyService.listItems?.({ limit }),
          pharmacyService.listPrescriptions?.({ limit: 10 }),
          pharmacyService.listFacilityTransfers?.({ limit: 6, scope: "facility" }),
        ]);

        if (!active) return;

        setItems(Array.isArray(inventoryRes?.items) ? inventoryRes.items : []);
        setPrescriptions(Array.isArray(prescriptionRes?.items) ? prescriptionRes.items : []);
        setTransfers(Array.isArray(transferRes?.items) ? transferRes.items : []);
        setError("");
      } catch (err) {
        if (!active) return;
        setItems([]);
        setPrescriptions([]);
        setTransfers([]);
        setError(err?.message || "Unable to load pharmacy overview.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [limit]);

  const lowStock = useMemo(() => items.filter((i) => Number(i?.qty || 0) <= Number(i?.minStock || 0)).length, [items]);
  const pendingPrescriptions = useMemo(() => prescriptions.filter((item) => item.status === "CREATED").length, [prescriptions]);
  const dispensedToday = useMemo(() => prescriptions.filter((item) => item.status === "DISPENSED").length, [prescriptions]);
  const pendingTransfers = useMemo(() => transfers.filter((t) => String(t?.status || "").toUpperCase() === "PENDING").length, [transfers]);

  return {
    items,
    prescriptions,
    transfers,
    error,
    loading,
    lowStock,
    pendingPrescriptions,
    dispensedToday,
    pendingTransfers,
  };
}

export default usePharmacyDashboard;
