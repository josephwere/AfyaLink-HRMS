import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../utils/auth";
import { normalizeRole } from "../utils/normalizeRole";
import {
  approveLeave,
  rejectLeave,
  approveOvertime,
  rejectOvertime,
  listPendingQueue,
  approveShift,
  rejectShift,
  getWorkforceQueueInsights,
  getWorkforceSlaPolicies,
  updateWorkforceSlaPolicy,
  getWorkforceAutomationPolicies,
  getWorkforceAutomationPresets,
  getWorkforceAutomationPresetHistory,
  applyWorkforceAutomationPresetAll,
  upsertWorkforceAutomationPreset,
  deactivateWorkforceAutomationPreset,
  reactivateWorkforceAutomationPreset,
  runWorkforceAutomationSweep,
  previewWorkforceEscalation,
  simulateWorkforceAutomation,
  updateWorkforceAutomationPolicy,
} from "../services/workforceApi";

const ALLOWED = new Set([
  "HOSPITAL_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
]);
const PRESET_LIFECYCLE_ALLOWED = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);
const TRIAGE_PREF_KEY = "approvals_triage_prefs";
const APPROVALS_CACHE_KEY = "approvals_query_cache_v1";
const APPROVALS_CACHE_TTL_MS = 15 * 60 * 1000;

function unwrapItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeCursorResponse(data) {
  if (Array.isArray(data)) return { items: data, nextCursor: null, hasMore: false };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    nextCursor: data?.nextCursor || null,
    hasMore: Boolean(data?.hasMore),
  };
}

export function useHospitalAdminApprovals() {
  const { user } = useAuth();
  const location = window.location;
  const [leave, setLeave] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaveCursor, setLeaveCursor] = useState(null);
  const [overtimeCursor, setOvertimeCursor] = useState(null);
  const [shiftCursor, setShiftCursor] = useState(null);
  const [hasMoreLeave, setHasMoreLeave] = useState(false);
  const [hasMoreOvertime, setHasMoreOvertime] = useState(false);
  const [hasMoreShift, setHasMoreShift] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreKind, setLoadingMoreKind] = useState("");
  const [queue, setQueue] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [policyEdits, setPolicyEdits] = useState({});
  const [automationPolicies, setAutomationPolicies] = useState([]);
  const [automationPresets, setAutomationPresets] = useState([]);
  const [showInactivePresets, setShowInactivePresets] = useState(false);
  const [presetHistory, setPresetHistory] = useState([]);
  const [customPreset, setCustomPreset] = useState({
    key: "",
    name: "",
    description: "",
    config: {
      active: true,
      autoApprove: false,
      requireSecondApprover: true,
      fallbackRole: "AUTO",
      escalationAfterMinutes: 120,
      conditions: {
        priorityAgeMultiplier: 1,
        priorityWeightCap: 5,
      },
    },
  });
  const [automationEdits, setAutomationEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [viewMode, setViewMode] = useState("ALL");
  const [queueKindFilter, setQueueKindFilter] = useState("ALL");
  const [breachCursor, setBreachCursor] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [pendingAutoJump, setPendingAutoJump] = useState(false);
  const [activeBreachKey, setActiveBreachKey] = useState("");
  const [filter, setFilter] = useState("");
  const filterRef = useRef(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheBadge, setCacheBadge] = useState("Live • now");
  const skipInitialNetworkLoadRef = useRef(false);

  const role = normalizeRole(user?.actualRole || user?.role);
  const allowed = ALLOWED.has(role);
  const prefScope = `${role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;
  const canManagePresetLifecycle = PRESET_LIFECYCLE_ALLOWED.has(role);

  const loadApprovalsData = useCallback(async ({ append = false, queueKind = queueKindFilter } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setMsg(null);
    try {
      const targetKinds = queueKind === "ALL" ? ["LEAVE", "OVERTIME", "SHIFT"] : [queueKind];
      const shouldFetchLeave = targetKinds.includes("LEAVE") && (!append || (hasMoreLeave && Boolean(leaveCursor)));
      const shouldFetchOvertime = targetKinds.includes("OVERTIME") && (!append || (hasMoreOvertime && Boolean(overtimeCursor)));
      const shouldFetchShift = targetKinds.includes("SHIFT") && (!append || (hasMoreShift && Boolean(shiftCursor)));

      const [l, o, s, q, p, ap, presetsResp, presetHistoryResp] = await Promise.all([
        shouldFetchLeave ? listPendingQueue("LEAVE", "PENDING", { cursorMode: true, limit: 25, cursor: append ? leaveCursor : undefined }) : Promise.resolve(null),
        shouldFetchOvertime ? listPendingQueue("OVERTIME", "PENDING", { cursorMode: true, limit: 25, cursor: append ? overtimeCursor : undefined }) : Promise.resolve(null),
        shouldFetchShift ? listPendingQueue("SHIFT", "PENDING", { cursorMode: true, limit: 25, cursor: append ? shiftCursor : undefined }) : Promise.resolve(null),
        append ? Promise.resolve(queue) : getWorkforceQueueInsights(),
        append ? Promise.resolve({ items: policies }) : getWorkforceSlaPolicies(),
        append ? Promise.resolve({ items: automationPolicies }) : getWorkforceAutomationPolicies(),
        append ? Promise.resolve({ items: automationPresets }) : getWorkforceAutomationPresets({ includeInactive: showInactivePresets }),
        append ? Promise.resolve({ items: presetHistory }) : getWorkforceAutomationPresetHistory({ limit: 50 }),
      ]);

      const leavePayload = shouldFetchLeave ? normalizeCursorResponse(l) : { items: [], nextCursor: null, hasMore: false };
      const overtimePayload = shouldFetchOvertime ? normalizeCursorResponse(o) : { items: [], nextCursor: null, hasMore: false };
      const shiftPayload = shouldFetchShift ? normalizeCursorResponse(s) : { items: [], nextCursor: null, hasMore: false };

      if (append) {
        if (shouldFetchLeave) {
          setLeave((prev) => [...prev, ...leavePayload.items]);
          setLeaveCursor(leavePayload.nextCursor);
          setHasMoreLeave(leavePayload.hasMore);
        } else setHasMoreLeave(false);
        if (shouldFetchOvertime) {
          setOvertime((prev) => [...prev, ...overtimePayload.items]);
          setOvertimeCursor(overtimePayload.nextCursor);
          setHasMoreOvertime(overtimePayload.hasMore);
        } else setHasMoreOvertime(false);
        if (shouldFetchShift) {
          setShifts((prev) => [...prev, ...shiftPayload.items]);
          setShiftCursor(shiftPayload.nextCursor);
          setHasMoreShift(shiftPayload.hasMore);
        } else setHasMoreShift(false);
      } else {
        setLeave(leavePayload.items);
        setOvertime(overtimePayload.items);
        setShifts(shiftPayload.items);
        setLeaveCursor(leavePayload.nextCursor);
        setOvertimeCursor(overtimePayload.nextCursor);
        setShiftCursor(shiftPayload.nextCursor);
        setHasMoreLeave(leavePayload.hasMore);
        setHasMoreOvertime(overtimePayload.hasMore);
        setHasMoreShift(shiftPayload.hasMore);
      }

      setQueue(q || null);
      const list = Array.isArray(p?.items) ? p.items : [];
      if (!append) {
        setCacheBadge("Live • now");
        setPolicies(list);
        setPolicyEdits(list.reduce((acc, row) => {
          acc[row.requestType] = { targetMinutes: row.targetMinutes, escalationMinutes: row.escalationMinutes, active: row.active !== false };
          return acc;
        }, {}));
      }
      const aList = Array.isArray(ap?.items) ? ap.items : [];
      const presetList = Array.isArray(presetsResp?.items) ? presetsResp.items : [];
      const historyList = Array.isArray(presetHistoryResp?.items) ? presetHistoryResp.items : [];
      if (!append) {
        setAutomationPolicies(aList);
        setAutomationPresets(presetList);
        setPresetHistory(historyList);
        setAutomationEdits(aList.reduce((acc, row) => {
          acc[row.requestType] = {
            active: row.active !== false,
            autoApprove: row.autoApprove === true,
            requireSecondApprover: row.requireSecondApprover === true,
            fallbackRole: row.fallbackRole || "HOSPITAL_ADMIN",
            escalationAfterMinutes: Number(row.escalationAfterMinutes || 120),
            conditions: {
              maxLeaveDays: Number(row.conditions?.maxLeaveDays || 0),
              maxOvertimeHours: Number(row.conditions?.maxOvertimeHours || 0),
              priorityAgeMultiplier: Number(row.conditions?.priorityAgeMultiplier ?? 1),
              priorityWeightCap: Number(row.conditions?.priorityWeightCap ?? 5),
              allowedShiftTypes: Array.isArray(row.conditions?.allowedShiftTypes) ? row.conditions.allowedShiftTypes.join(",") : "",
              fallbackCandidates: Array.isArray(row.conditions?.fallbackCandidates) ? row.conditions.fallbackCandidates.join(",") : "",
            },
          };
          return acc;
        }, {}));
      }
    } catch (err) {
      setMsg(err?.message || "Failed to load approvals");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [automationPolicies, automationPresets, hasMoreLeave, hasMoreOvertime, hasMoreShift, leaveCursor, overtimeCursor, policies, presetHistory, queue, showInactivePresets, shiftCursor]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APPROVALS_CACHE_KEY);
      if (!raw) {
        setCacheBadge("Live • now");
        setCacheReady(true);
        return;
      }
      const all = JSON.parse(raw);
      const cached = all?.[prefScope];
      if (!cached || typeof cached !== "object") {
        setCacheBadge("Live • now");
        setCacheReady(true);
        return;
      }
      const age = Date.now() - new Date(cached.updatedAt || 0).getTime();
      if (!Number.isFinite(age) || age < 0 || age > APPROVALS_CACHE_TTL_MS) {
        setCacheBadge("Live • now");
        setCacheReady(true);
        return;
      }
      const ageMinutes = Math.max(0, Math.floor(age / 60000));
      if (cached.queueKindFilter) setQueueKindFilter(cached.queueKindFilter);
      if (Array.isArray(cached.leave)) setLeave(cached.leave);
      if (Array.isArray(cached.overtime)) setOvertime(cached.overtime);
      if (Array.isArray(cached.shifts)) setShifts(cached.shifts);
      if (typeof cached.leaveCursor === "string" || cached.leaveCursor === null) setLeaveCursor(cached.leaveCursor);
      if (typeof cached.overtimeCursor === "string" || cached.overtimeCursor === null) setOvertimeCursor(cached.overtimeCursor);
      if (typeof cached.shiftCursor === "string" || cached.shiftCursor === null) setShiftCursor(cached.shiftCursor);
      if (typeof cached.hasMoreLeave === "boolean") setHasMoreLeave(cached.hasMoreLeave);
      if (typeof cached.hasMoreOvertime === "boolean") setHasMoreOvertime(cached.hasMoreOvertime);
      if (typeof cached.hasMoreShift === "boolean") setHasMoreShift(cached.hasMoreShift);
      if (cached.queue && typeof cached.queue === "object") setQueue(cached.queue);
      setCacheBadge(`Cached • ${ageMinutes}m ago`);
      skipInitialNetworkLoadRef.current = true;
    } catch {
      // ignore cache restore failures
    } finally {
      setCacheReady(true);
    }
  }, [prefScope]);

  useEffect(() => {
    if (!cacheReady) return;
    if (skipInitialNetworkLoadRef.current) {
      skipInitialNetworkLoadRef.current = false;
      return;
    }
    void loadApprovalsData({ append: false, queueKind: queueKindFilter });
  }, [cacheReady, loadApprovalsData, queueKindFilter, showInactivePresets]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const queryView = String(qs.get("view") || "").toLowerCase();
    const hasViewInQuery = qs.has("view");
    if (hasViewInQuery) setViewMode(queryView === "breached" ? "BREACHED" : "ALL");
    const queryKind = String(qs.get("kind") || "").toUpperCase();
    if (["LEAVE", "OVERTIME", "SHIFT"].includes(queryKind)) setQueueKindFilter(queryKind);
    else if (qs.has("kind")) setQueueKindFilter("ALL");
    const hash = location.hash;
    if (hash) {
      const target = document.getElementById(hash.replace("#", ""));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 120);
    }
  }, [location]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRIAGE_PREF_KEY);
      if (!raw) return;
      const all = JSON.parse(raw);
      const pref = all?.[prefScope];
      if (!pref || typeof pref !== "object") return;
      if (pref.viewMode === "ALL" || pref.viewMode === "BREACHED") setViewMode(pref.viewMode);
      if (typeof pref.autoAdvance === "boolean") setAutoAdvance(pref.autoAdvance);
      if (typeof pref.filter === "string") setFilter(pref.filter);
    } catch {
      // ignore preference restore failures
    }
  }, [prefScope]);

  const applyAutomationPreset = useCallback((requestType, presetKey) => {
    const preset = automationPresets.find((item) => String(item?.key || "").toUpperCase() === String(presetKey || "").toUpperCase())?.config;
    if (!preset) return;
    setAutomationEdits((prev) => ({
      ...prev,
      [requestType]: {
        ...prev[requestType],
        active: true,
        autoApprove: preset.autoApprove,
        requireSecondApprover: preset.requireSecondApprover,
        fallbackRole: preset.fallbackRole,
        escalationAfterMinutes: preset.escalationAfterMinutes,
        conditions: {
          ...prev[requestType]?.conditions,
          priorityAgeMultiplier: Number(preset.conditions?.priorityAgeMultiplier ?? 1),
          priorityWeightCap: Number(preset.conditions?.priorityWeightCap ?? 5),
        },
      },
    }));
  }, [automationPresets]);

  const savePolicyEdit = useCallback(async (requestType) => {
    setSavingPolicy(true);
    setMsg(null);
    try {
      await updateWorkforceSlaPolicy(requestType, policyEdits[requestType]);
      setMsg("SLA policy updated.");
      await loadApprovalsData({ append: false, queueKind: queueKindFilter });
    } catch (err) {
      setMsg(err?.message || "Could not update SLA policy.");
    } finally {
      setSavingPolicy(false);
    }
  }, [loadApprovalsData, policyEdits, queueKindFilter]);

  const approveItem = useCallback(async (kind, id) => {
    try {
      if (kind === "LEAVE") await approveLeave(id);
      if (kind === "OVERTIME") await approveOvertime(id);
      if (kind === "SHIFT") await approveShift(id);
      setMsg("Request approved.");
      await loadApprovalsData({ append: false, queueKind: queueKindFilter });
    } catch (err) {
      setMsg(err?.message || "Approval failed.");
    }
  }, [loadApprovalsData, queueKindFilter]);

  const rejectItem = useCallback(async (kind, id, reason = "") => {
    try {
      if (kind === "LEAVE") await rejectLeave(id, reason);
      if (kind === "OVERTIME") await rejectOvertime(id, reason);
      if (kind === "SHIFT") await rejectShift(id, reason);
      setMsg("Request rejected.");
      await loadApprovalsData({ append: false, queueKind: queueKindFilter });
    } catch (err) {
      setMsg(err?.message || "Rejection failed.");
    }
  }, [loadApprovalsData, queueKindFilter]);

  const summary = useMemo(() => ({
    leave: leave.length,
    overtime: overtime.length,
    shifts: shifts.length,
  }), [leave.length, overtime.length, shifts.length]);

  return {
    allowed,
    role,
    canManagePresetLifecycle,
    leave,
    overtime,
    shifts,
    leaveCursor,
    overtimeCursor,
    shiftCursor,
    hasMoreLeave,
    hasMoreOvertime,
    hasMoreShift,
    loadingMore,
    loadingMoreKind,
    queue,
    policies,
    policyEdits,
    setPolicyEdits,
    automationPolicies,
    automationPresets,
    showInactivePresets,
    setShowInactivePresets,
    presetHistory,
    customPreset,
    setCustomPreset,
    automationEdits,
    setAutomationEdits,
    loading,
    savingPolicy,
    savingAutomation,
    simResult,
    previewResult,
    previewLoading,
    msg,
    viewMode,
    setViewMode,
    queueKindFilter,
    setQueueKindFilter,
    breachCursor,
    setBreachCursor,
    autoAdvance,
    setAutoAdvance,
    pendingAutoJump,
    setPendingAutoJump,
    activeBreachKey,
    setActiveBreachKey,
    filter,
    setFilter,
    filterRef,
    cacheReady,
    cacheBadge,
    loadApprovalsData,
    applyAutomationPreset,
    savePolicyEdit,
    approveItem,
    rejectItem,
    summary,
    unwrapItems,
  };
}

export default useHospitalAdminApprovals;
