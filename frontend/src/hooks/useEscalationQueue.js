import { useEffect, useMemo, useState } from "react";
import {
  listEscalations,
  bulkResolveEscalations,
  bulkAssignEscalations,
  bulkReviewEscalations,
} from "../services/hospitalAdminOperationsApi";

export function useEscalationQueue(viewer = "hospital") {
  const [rows, setRows] = useState([]);
  const [clinicians, setClinicians] = useState([]);
  const [wards, setWards] = useState([]);
  const [status, setStatus] = useState("OPEN");
  const [missingRequirement, setMissingRequirement] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [ward, setWard] = useState("");
  const [sort, setSort] = useState("NEWEST");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkNote, setBulkNote] = useState("Resolved from escalation queue.");
  const [assignClinicianId, setAssignClinicianId] = useState("");
  const [resolving, setResolving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const isDoctorView = viewer === "doctor";

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = {
        status: status || undefined,
        missingRequirement: missingRequirement || undefined,
        clinicianId: clinicianId || undefined,
        ward: ward || undefined,
        sort: sort || undefined,
        q: q.trim() || undefined,
        page,
        pageSize,
      };
      const res = await listEscalations(params);
      setRows(Array.isArray(res?.items) ? res.items : []);
      setClinicians(Array.isArray(res?.clinicians) ? res.clinicians : []);
      setWards(Array.isArray(res?.wards) ? res.wards : []);
      setTotal(Number(res?.total || 0));
      setSelectedIds((prev) => prev.filter((id) => (Array.isArray(res?.items) ? res.items : []).some((item) => String(item.id) === String(id))));
    } catch (err) {
      setMsg(err?.message || "Could not load escalation queue.");
      setRows([]);
      setClinicians([]);
      setWards([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, missingRequirement, clinicianId, ward, sort, page, pageSize]);

  const summary = useMemo(
    () => ({
      open: status === "OPEN" ? total : rows.filter((row) => row.status === "OPEN").length,
      resolved: status === "RESOLVED" ? total : rows.filter((row) => row.status === "RESOLVED").length,
    }),
    [rows, status, total]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applyQuickFilter = (next) => {
    setPage(1);
    if (Object.prototype.hasOwnProperty.call(next, "status")) setStatus(next.status);
    if (Object.prototype.hasOwnProperty.call(next, "missingRequirement")) setMissingRequirement(next.missingRequirement);
    if (Object.prototype.hasOwnProperty.call(next, "clinicianId")) setClinicianId(next.clinicianId);
    if (Object.prototype.hasOwnProperty.call(next, "ward")) setWard(next.ward);
    if (Object.prototype.hasOwnProperty.call(next, "sort")) setSort(next.sort);
    if (Object.prototype.hasOwnProperty.call(next, "q")) setQ(next.q);
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(String(id)) ? prev.filter((item) => item !== String(id)) : [...prev, String(id)]));
  };

  const togglePageSelection = () => {
    const openIds = rows.filter((item) => item.status === "OPEN").map((item) => String(item.id));
    const allSelected = openIds.length > 0 && openIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => (allSelected ? prev.filter((id) => !openIds.includes(id)) : [...new Set([...prev, ...openIds])]));
  };

  const bulkResolve = async () => {
    if (!selectedIds.length) return;
    try {
      setResolving(true);
      setMsg("");
      const res = await bulkResolveEscalations(selectedIds, bulkNote);
      setMsg(`Resolved ${res?.resolved || 0} escalation notifications across ${res?.encounters || 0} visits.`);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setMsg(err?.message || "Bulk resolve failed.");
    } finally {
      setResolving(false);
    }
  };

  const bulkAssign = async () => {
    if (!selectedIds.length || !assignClinicianId) return;
    try {
      setAssigning(true);
      setMsg("");
      const res = await bulkAssignEscalations(selectedIds, assignClinicianId);
      setMsg(`Assigned ${res?.updated || 0} visits to clinician.`);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setMsg(err?.message || "Bulk assign failed.");
    } finally {
      setAssigning(false);
    }
  };

  const bulkReview = async () => {
    if (!selectedIds.length) return;
    try {
      setReviewing(true);
      setMsg("");
      const res = await bulkReviewEscalations(selectedIds);
      setMsg(`Marked ${res?.reviewed || 0} escalation notices as reviewed.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Bulk review failed.");
    } finally {
      setReviewing(false);
    }
  };

  return {
    rows,
    clinicians,
    wards,
    status,
    setStatus,
    missingRequirement,
    setMissingRequirement,
    clinicianId,
    setClinicianId,
    ward,
    setWard,
    sort,
    setSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    q,
    setQ,
    loading,
    msg,
    selectedIds,
    setSelectedIds,
    bulkNote,
    setBulkNote,
    assignClinicianId,
    setAssignClinicianId,
    resolving,
    assigning,
    reviewing,
    isDoctorView,
    load,
    summary,
    totalPages,
    applyQuickFilter,
    toggleSelected,
    togglePageSelection,
    bulkResolve,
    bulkAssign,
    bulkReview,
  };
}

export default useEscalationQueue;
