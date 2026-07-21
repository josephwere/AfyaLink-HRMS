import { useEffect, useMemo, useRef, useState } from "react";
import { listAiAdminLogs } from "../services/aiAdminApi";
import { useAuth } from "../utils/auth";

const ACTION_OPTIONS = [
  { value: "AI_ASSISTANT_AUTOFILL_DRAFTED", label: "Drafted" },
  { value: "AI_ASSISTANT_AUTOFILL_APPLIED", label: "Applied" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatActor(row) {
  return row?.actor?.name || row?.actor?.email || row?.actor?.role || "System";
}

function formatHospital(row) {
  return row?.hospital?.name || row?.hospital?.code || row?.hospitalKey || "Global";
}

export function useAIAutofillAudit() {
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const defaultHospitalKey = role === "HOSPITAL_ADMIN" ? String(user?.hospitalId || user?.hospital || "") : "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    actions: ACTION_OPTIONS.map((row) => row.value),
    hospitalKey: defaultHospitalKey,
    limit: 100,
  });
  const logSectionRef = useRef(null);

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setMsg("");
    try {
      const data = await listAiAdminLogs(nextFilters);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setItems([]);
      setMsg(err?.message || "Failed to load AI autofill audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({
      ...filters,
      hospitalKey: defaultHospitalKey || filters.hospitalKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    if (!needle) return items;
    return items.filter((row) => {
      const metadata = row?.metadata || {};
      const values = [
        row.action,
        row.summary,
        row.route,
        row.hospitalKey,
        formatActor(row),
        formatHospital(row),
        ...safeArray(metadata.sourceKinds),
        ...safeArray(metadata.unmatched),
        ...safeArray(metadata.items).flatMap((item) => [
          item?.fieldLabel,
          item?.value,
          item?.status,
          item?.reason,
          item?.evidence,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return values.includes(needle);
    });
  }, [items, search]);

  const stats = useMemo(() => {
    const drafted = visibleItems.filter((row) => row.action === "AI_ASSISTANT_AUTOFILL_DRAFTED").length;
    const applied = visibleItems.filter((row) => row.action === "AI_ASSISTANT_AUTOFILL_APPLIED").length;
    const hospitals = new Set(visibleItems.map((row) => row.hospitalKey || row.hospital?.id).filter(Boolean)).size;
    const queuedFields = visibleItems.reduce((sum, row) => {
      const count = safeArray(row?.metadata?.items).filter((item) => item?.status === "queued").length;
      return sum + count;
    }, 0);
    const appliedFields = visibleItems.reduce((sum, row) => {
      const count = safeArray(row?.metadata?.items).filter((item) => item?.status === "applied").length;
      return sum + count;
    }, 0);
    return { drafted, applied, hospitals, queuedFields, appliedFields };
  }, [visibleItems]);

  const selectedItem = visibleItems.find((row) => row.id === selectedId) || null;

  const toggleAction = (action) => {
    setFilters((prev) => {
      const next = prev.actions.includes(action)
        ? prev.actions.filter((entry) => entry !== action)
        : [...prev.actions, action];
      return {
        ...prev,
        actions: next.length ? next : [action],
      };
    });
  };

  const applySummaryActions = (actions) => {
    const nextFilters = {
      ...filters,
      actions,
    };
    setFilters(nextFilters);
    load(nextFilters);
    scrollToSection(logSectionRef);
  };

  return {
    items,
    loading,
    msg,
    selectedId,
    setSelectedId,
    search,
    setSearch,
    filters,
    setFilters,
    visibleItems,
    stats,
    load,
    toggleAction,
    applySummaryActions,
    logSectionRef,
    selectedItem,
    defaultHospitalKey,
  };
}

export default useAIAutofillAudit;
