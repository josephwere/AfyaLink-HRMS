import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../utils/apiFetch";
import { listRegisteredPharmacies } from "../services/pharmacyNetworkApi";

export function usePharmacyAccessAudit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState({ total: 0, linked: 0, unlinked: 0 });
  const [items, setItems] = useState([]);
  const [pharmacyNameById, setPharmacyNameById] = useState({});
  const [preview, setPreview] = useState({
    summary: { scanned: 0, matched: 0, ambiguous: 0, skipped: 0 },
    matched: [],
    ambiguous: [],
    skipped: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [allRes, missingRes, pharmacyRes, previewRes] = await Promise.all([
        apiFetch("/api/users?role=PHARMACIST&page=1&limit=500"),
        apiFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500"),
        listRegisteredPharmacies({ includeInactive: true, limit: 500 }),
        apiFetch("/api/users/pharmacy-link-backfill-preview"),
      ]);
      const all = Array.isArray(allRes?.items) ? allRes.items : [];
      const missing = Array.isArray(missingRes?.items) ? missingRes.items : [];
      const pharmacies = Array.isArray(pharmacyRes?.items) ? pharmacyRes.items : [];
      setItems(all);
      setSummary({
        total: all.length,
        unlinked: missing.length,
        linked: Math.max(all.length - missing.length, 0),
      });
      setPharmacyNameById(
        pharmacies.reduce((acc, item) => {
          acc[String(item._id)] = item.name;
          return acc;
        }, {})
      );
      setPreview({
        summary: previewRes?.summary || { scanned: 0, matched: 0, ambiguous: 0, skipped: 0 },
        matched: Array.isArray(previewRes?.matched) ? previewRes.matched : [],
        ambiguous: Array.isArray(previewRes?.ambiguous) ? previewRes.ambiguous : [],
        skipped: Array.isArray(previewRes?.skipped) ? previewRes.skipped : [],
      });
    } catch (err) {
      setMsg(err?.message || "Could not load pharmacy access audit.");
      setItems([]);
      setSummary({ total: 0, linked: 0, unlinked: 0 });
      setPharmacyNameById({});
      setPreview({ summary: { scanned: 0, matched: 0, ambiguous: 0, skipped: 0 }, matched: [], ambiguous: [], skipped: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unlinkedRows = useMemo(() => items.filter((item) => !item.registeredPharmacy), [items]);

  return {
    navigate,
    loading,
    msg,
    summary,
    items,
    pharmacyNameById,
    preview,
    unlinkedRows,
    load,
  };
}

export default usePharmacyAccessAudit;
