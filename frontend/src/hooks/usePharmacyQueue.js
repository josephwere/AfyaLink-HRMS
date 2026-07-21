import { useEffect, useMemo, useState } from "react";
import pharmacyService from "../services/pharmacy";
import { listPharmacyReferrals, updatePharmacyReferral } from "../services/pharmacyNetworkApi";
import { listTransfers } from "../services/transferApi";

export function usePharmacyQueue() {
  const [items, setItems] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState("CREATED");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await pharmacyService.listPrescriptions?.();
      setItems(Array.isArray(res?.items) ? res.items : []);
      const referralRes = await listPharmacyReferrals({ limit: 50 });
      setReferrals(Array.isArray(referralRes?.items) ? referralRes.items : []);
      const transferRes = await listTransfers({ limit: 6, scope: "facility" });
      setTransfers(Array.isArray(transferRes?.items) ? transferRes.items : []);
      setTransferError("");
    } catch (err) {
      setItems([]);
      setReferrals([]);
      setTransfers([]);
      setTransferError(err?.message || "Failed to load transfers.");
      setMsg(err?.message || "Could not load pharmacy queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => String(item.status) === filter);
  }, [items, filter]);

  const dispense = async (item) => {
    try {
      setMsg("");
      await pharmacyService.dispenseStock?.(item._id, {
        prescriptionId: item._id,
        encounterId: item.encounter || undefined,
      });
      setMsg("Prescription dispensed.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not dispense prescription.");
    }
  };

  const updateReferralStatus = async (item, status) => {
    try {
      setMsg("");
      await updatePharmacyReferral(item._id, { status });
      setMsg(`Referral marked ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not update referral status.");
    }
  };

  return {
    items,
    referrals,
    filter,
    setFilter,
    loading,
    msg,
    transfers,
    transferError,
    visible,
    load,
    dispense,
    updateReferralStatus,
  };
}

export default usePharmacyQueue;
