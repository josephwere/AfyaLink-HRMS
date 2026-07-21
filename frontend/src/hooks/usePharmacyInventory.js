import { useEffect, useState } from "react";
import pharmacyService from "../services/pharmacy";
import { listTransfers } from "../services/transferApi";

export function usePharmacyInventory() {
  const [medicines, setMedicines] = useState([]);
  const [medicineError, setMedicineError] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [medicineRes, transferRes] = await Promise.all([
          pharmacyService.listAvailableMedicines({ limit: 100, includeOutOfStock: true }),
          listTransfers({ limit: 6, scope: "facility" }),
        ]);

        if (!active) return;

        setMedicines(Array.isArray(medicineRes?.items) ? medicineRes.items : []);
        setMedicineError("");
        setTransfers(Array.isArray(transferRes?.items) ? transferRes.items : []);
        setTransferError("");
      } catch (err) {
        if (!active) return;
        setMedicines([]);
        setMedicineError(err?.message || "Failed to load medicine inventory.");
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return {
    medicines,
    medicineError,
    transfers,
    transferError,
    loading,
  };
}

export default usePharmacyInventory;
