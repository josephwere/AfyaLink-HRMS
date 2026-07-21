import { useEffect, useMemo, useState } from "react";
import { listMyPrescriptions } from "../services/patientApi";
import { listPharmacyReferrals } from "../services/pharmacyNetworkApi";

export function usePatientPrescriptions() {
  const [items, setItems] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [res, referralRes] = await Promise.all([listMyPrescriptions(), listPharmacyReferrals({ limit: 50 })]);
      setItems(Array.isArray(res?.items) ? res.items : []);
      setReferrals(Array.isArray(referralRes?.items) ? referralRes.items : []);
    } catch (err) {
      setItems([]);
      setReferrals([]);
      setMsg(err?.message || "Could not load prescriptions.");
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

  return { items, referrals, filter, setFilter, loading, msg, visible, load };
}

export default usePatientPrescriptions;
