import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../utils/auth";
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
} from "../../services/workforceApi";

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

function isOverdue(item) {
  if (!item?.slaDueAt) return false;
  return item.status === "PENDING" && new Date(item.slaDueAt).getTime() < Date.now();
}

export default function Approvals() {
  const { user } = useAuth();
  const location = useLocation();
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

  const role = user?.role;
  if (!ALLOWED.has(role)) {
    return <p>Access denied</p>;
  }
  const prefScope = `${role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;
  const canManagePresetLifecycle = PRESET_LIFECYCLE_ALLOWED.has(role);

  const normalizeCursorResponse = (data) => {
    if (Array.isArray(data)) {
      return { items: data, nextCursor: null, hasMore: false };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      nextCursor: data?.nextCursor || null,
      hasMore: Boolean(data?.hasMore),
    };
  };

  const applyAutomationPreset = (requestType, presetKey) => {
    const preset = automationPresets.find(
      (item) => String(item?.key || "").toUpperCase() === String(presetKey || "").toUpperCase()
    )?.config;
    if (!preset) return;
    setAutomationEdits((prev) => {
      const existing = prev[requestType] || {};
      const currentConditions = existing.conditions || {};
      return {
        ...prev,
        [requestType]: {
          ...existing,
          active: true,
          autoApprove: preset.autoApprove,
          requireSecondApprover: preset.requireSecondApprover,
          fallbackRole: preset.fallbackRole,
          escalationAfterMinutes: preset.escalationAfterMinutes,
          conditions: {
            ...currentConditions,
            priorityAgeMultiplier: Number(preset.conditions?.priorityAgeMultiplier ?? 1),
            priorityWeightCap: Number(preset.conditions?.priorityWeightCap ?? 5),
          },
        },
      };
    });
  };

  const loadAll = async ({ append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setMsg(null);
    try {
      const targetKinds =
        queueKindFilter === "ALL"
          ? ["LEAVE", "OVERTIME", "SHIFT"]
          : [queueKindFilter];
      const shouldFetchLeave =
        targetKinds.includes("LEAVE") && (!append || (hasMoreLeave && Boolean(leaveCursor)));
      const shouldFetchOvertime =
        targetKinds.includes("OVERTIME") &&
        (!append || (hasMoreOvertime && Boolean(overtimeCursor)));
      const shouldFetchShift =
        targetKinds.includes("SHIFT") && (!append || (hasMoreShift && Boolean(shiftCursor)));

      const [l, o, s, q, p, ap, presetsResp, presetHistoryResp] = await Promise.all([
        shouldFetchLeave
          ? listPendingQueue("LEAVE", "PENDING", {
              cursorMode: true,
              limit: 25,
              cursor: append ? leaveCursor : undefined,
            })
          : Promise.resolve(null),
        shouldFetchOvertime
          ? listPendingQueue("OVERTIME", "PENDING", {
              cursorMode: true,
              limit: 25,
              cursor: append ? overtimeCursor : undefined,
            })
          : Promise.resolve(null),
        shouldFetchShift
          ? listPendingQueue("SHIFT", "PENDING", {
              cursorMode: true,
              limit: 25,
              cursor: append ? shiftCursor : undefined,
            })
          : Promise.resolve(null),
        append ? Promise.resolve({ data: queue }) : getWorkforceQueueInsights(),
        append ? Promise.resolve({ data: { items: policies } }) : getWorkforceSlaPolicies(),
        append
          ? Promise.resolve({ data: { items: automationPolicies } })
          : getWorkforceAutomationPolicies(),
        append
          ? Promise.resolve({ data: { items: automationPresets } })
          : getWorkforceAutomationPresets({ includeInactive: showInactivePresets }),
        append
          ? Promise.resolve({ data: { items: presetHistory } })
          : getWorkforceAutomationPresetHistory({ limit: 50 }),
      ]);

      const leavePayload = shouldFetchLeave
        ? normalizeCursorResponse(l.data)
        : { items: [], nextCursor: null, hasMore: false };
      const overtimePayload = shouldFetchOvertime
        ? normalizeCursorResponse(o.data)
        : { items: [], nextCursor: null, hasMore: false };
      const shiftPayload = shouldFetchShift
        ? normalizeCursorResponse(s.data)
        : { items: [], nextCursor: null, hasMore: false };

      if (append) {
        if (shouldFetchLeave) {
          setLeave((prev) => [...prev, ...leavePayload.items]);
          setLeaveCursor(leavePayload.nextCursor);
          setHasMoreLeave(leavePayload.hasMore);
        } else {
          setHasMoreLeave(false);
        }
        if (shouldFetchOvertime) {
          setOvertime((prev) => [...prev, ...overtimePayload.items]);
          setOvertimeCursor(overtimePayload.nextCursor);
          setHasMoreOvertime(overtimePayload.hasMore);
        } else {
          setHasMoreOvertime(false);
        }
        if (shouldFetchShift) {
          setShifts((prev) => [...prev, ...shiftPayload.items]);
          setShiftCursor(shiftPayload.nextCursor);
          setHasMoreShift(shiftPayload.hasMore);
        } else {
          setHasMoreShift(false);
        }
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
      setQueue(q.data || null);
      const list = Array.isArray(p.data?.items) ? p.data.items : [];
      if (!append) {
        setCacheBadge("Live • now");
        setPolicies(list);
        setPolicyEdits(
          list.reduce((acc, row) => {
            acc[row.requestType] = {
              targetMinutes: row.targetMinutes,
              escalationMinutes: row.escalationMinutes,
              active: row.active !== false,
            };
            return acc;
          }, {})
        );
      }
      const aList = Array.isArray(ap.data?.items) ? ap.data.items : [];
      const presetList = Array.isArray(presetsResp.data?.items)
        ? presetsResp.data.items
        : [];
      const historyList = Array.isArray(presetHistoryResp.data?.items)
        ? presetHistoryResp.data.items
        : [];
      if (!append) {
        setAutomationPolicies(aList);
        setAutomationPresets(presetList);
        setPresetHistory(historyList);
        setAutomationEdits(
          aList.reduce((acc, row) => {
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
                allowedShiftTypes: Array.isArray(row.conditions?.allowedShiftTypes)
                  ? row.conditions.allowedShiftTypes.join(",")
                  : "",
                fallbackCandidates: Array.isArray(row.conditions?.fallbackCandidates)
                  ? row.conditions.fallbackCandidates.join(",")
                  : "",
              },
            };
            return acc;
          }, {})
        );
      }
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to load approvals");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

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
      if (typeof cached.leaveCursor === "string" || cached.leaveCursor === null) {
        setLeaveCursor(cached.leaveCursor);
      }
      if (typeof cached.overtimeCursor === "string" || cached.overtimeCursor === null) {
        setOvertimeCursor(cached.overtimeCursor);
      }
      if (typeof cached.shiftCursor === "string" || cached.shiftCursor === null) {
        setShiftCursor(cached.shiftCursor);
      }
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
    loadAll({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheReady, queueKindFilter, showInactivePresets]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const queryView = String(qs.get("view") || "").toLowerCase();
    const hasViewInQuery = qs.has("view");
    if (hasViewInQuery) {
      setViewMode(queryView === "breached" ? "BREACHED" : "ALL");
    }

    const hash = window.location.hash;
    if (!hash) return;
    const target = document.getElementById(hash.replace("#", ""));
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 120);
    }
  }, [location.search]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRIAGE_PREF_KEY);
      if (!raw) return;
      const all = JSON.parse(raw);
      const pref = all?.[prefScope];
      if (!pref || typeof pref !== "object") return;
      if (pref.viewMode === "ALL" || pref.viewMode === "BREACHED") {
        setViewMode(pref.viewMode);
      }
      if (typeof pref.autoAdvance === "boolean") {
        setAutoAdvance(pref.autoAdvance);
      }
      if (typeof pref.filter === "string") {
        setFilter(pref.filter);
      }
    } catch {
      // ignore malformed local preferences
    }
  }, [prefScope]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRIAGE_PREF_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[prefScope] = {
        viewMode,
        autoAdvance,
        filter,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(TRIAGE_PREF_KEY, JSON.stringify(all));
    } catch {
      // ignore storage errors
    }
  }, [prefScope, viewMode, autoAdvance, filter]);

  useEffect(() => {
    if (!cacheReady) return;
    try {
      const raw = localStorage.getItem(APPROVALS_CACHE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[prefScope] = {
        queueKindFilter,
        leave,
        overtime,
        shifts,
        leaveCursor,
        overtimeCursor,
        shiftCursor,
        hasMoreLeave,
        hasMoreOvertime,
        hasMoreShift,
        queue,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(APPROVALS_CACHE_KEY, JSON.stringify(all));
    } catch {
      // ignore cache persistence failures
    }
  }, [
    cacheReady,
    prefScope,
    queueKindFilter,
    leave,
    overtime,
    shifts,
    leaveCursor,
    overtimeCursor,
    shiftCursor,
    hasMoreLeave,
    hasMoreOvertime,
    hasMoreShift,
    queue,
  ]);

  const pendingRows = useMemo(
    () =>
      [
        ...leave.map((item) => ({ ...item, kind: "LEAVE" })),
        ...overtime.map((item) => ({ ...item, kind: "OVERTIME" })),
        ...shifts.map((item) => ({ ...item, kind: "SHIFT" })),
      ]
        .filter((item) => (viewMode === "BREACHED" ? isOverdue(item) : true))
        .filter((item) => (queueKindFilter === "ALL" ? true : item.kind === queueKindFilter))
        .filter((item) => {
          const q = filter.trim().toLowerCase();
          if (!q) return true;
          const staff = String(item.requester?.name || "").toLowerCase();
          const role = String(item.requester?.role || "").toLowerCase();
          const kind = String(item.kind || "").toLowerCase();
          const category = String(item.type || item.shiftType || "").toLowerCase();
          const reason = String(item.reason || "").toLowerCase();
          return (
            staff.includes(q) ||
            role.includes(q) ||
            kind.includes(q) ||
            category.includes(q) ||
            reason.includes(q)
          );
        })
        .sort((a, b) => {
          const overdueA = isOverdue(a) ? 1 : 0;
          const overdueB = isOverdue(b) ? 1 : 0;
          if (overdueA !== overdueB) return overdueB - overdueA;
          const dueA = a.slaDueAt ? new Date(a.slaDueAt).getTime() : Number.MAX_SAFE_INTEGER;
          const dueB = b.slaDueAt ? new Date(b.slaDueAt).getTime() : Number.MAX_SAFE_INTEGER;
          if (dueA !== dueB) return dueA - dueB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
    [leave, overtime, shifts, viewMode, queueKindFilter, filter]
  );
  const breachedRows = useMemo(
    () => pendingRows.filter((item) => isOverdue(item)),
    [pendingRows]
  );
  const pendingByKind = useMemo(() => {
    const initial = { LEAVE: 0, OVERTIME: 0, SHIFT: 0 };
    for (const row of pendingRows) {
      if (Object.prototype.hasOwnProperty.call(initial, row.kind)) {
        initial[row.kind] += 1;
      }
    }
    return initial;
  }, [pendingRows]);

  const loadMoreByKind = async (kind) => {
    try {
      setLoadingMoreKind(kind);
      if (kind === "LEAVE") {
        if (!hasMoreLeave || !leaveCursor) return;
      const res = await listPendingQueue("LEAVE", "PENDING", {
        cursorMode: true,
        limit: 25,
        cursor: leaveCursor,
        });
        const payload = normalizeCursorResponse(res.data);
        setLeave((prev) => [...prev, ...payload.items]);
        setLeaveCursor(payload.nextCursor);
        setHasMoreLeave(payload.hasMore);
      }
      if (kind === "OVERTIME") {
        if (!hasMoreOvertime || !overtimeCursor) return;
        const res = await listPendingQueue("OVERTIME", "PENDING", {
          cursorMode: true,
          limit: 25,
          cursor: overtimeCursor,
        });
        const payload = normalizeCursorResponse(res.data);
        setOvertime((prev) => [...prev, ...payload.items]);
        setOvertimeCursor(payload.nextCursor);
        setHasMoreOvertime(payload.hasMore);
      }
      if (kind === "SHIFT") {
        if (!hasMoreShift || !shiftCursor) return;
        const res = await listPendingQueue("SHIFT", "PENDING", {
          cursorMode: true,
          limit: 25,
          cursor: shiftCursor,
        });
        const payload = normalizeCursorResponse(res.data);
        setShifts((prev) => [...prev, ...payload.items]);
        setShiftCursor(payload.nextCursor);
        setHasMoreShift(payload.hasMore);
      }
    } catch (err) {
      setMsg(err?.response?.data?.message || `Failed to load more ${kind} requests`);
    } finally {
      setLoadingMoreKind("");
    }
  };

  const resetView = async () => {
    try {
      const raw = localStorage.getItem(APPROVALS_CACHE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      delete all[prefScope];
      localStorage.setItem(APPROVALS_CACHE_KEY, JSON.stringify(all));
    } catch {
      // ignore cache clear errors
    }

    setQueueKindFilter("ALL");
    setViewMode("ALL");
    setFilter("");
    setLeave([]);
    setOvertime([]);
    setShifts([]);
    setLeaveCursor(null);
    setOvertimeCursor(null);
    setShiftCursor(null);
    setHasMoreLeave(false);
    setHasMoreOvertime(false);
    setHasMoreShift(false);
    await loadAll({ append: false });
    setCacheBadge("Live • now");
    setMsg("View reset and reloaded from server");
  };

  const jumpToNextBreached = () => {
    if (!breachedRows.length) return;
    const nextIndex = breachCursor % breachedRows.length;
    const item = breachedRows[nextIndex];
    const rowKey = `${item.kind}-${item._id}`;
    setActiveBreachKey(rowKey);
    const rowId = `breach-row-${rowKey}`;
    const el = document.getElementById(rowId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setBreachCursor((prev) => (prev + 1) % breachedRows.length);
  };

  useEffect(() => {
    if (!pendingAutoJump) return;
    setPendingAutoJump(false);
    setTimeout(() => {
      jumpToNextBreached();
    }, 120);
  }, [pendingAutoJump, pendingRows]);

  useEffect(() => {
    if (!activeBreachKey) return;
    const stillExists = breachedRows.some(
      (item) => `${item.kind}-${item._id}` === activeBreachKey
    );
    if (!stillExists) {
      setActiveBreachKey("");
    }
  }, [activeBreachKey, breachedRows]);

  const getActiveBreachRow = () => {
    if (!breachedRows.length) return null;
    if (activeBreachKey) {
      const found = breachedRows.find(
        (item) => `${item.kind}-${item._id}` === activeBreachKey
      );
      if (found) return found;
    }
    return breachedRows[0];
  };

  const doApprove = async (kind, id, wasOverdue = false) => {
    try {
      if (kind === "LEAVE") await approveLeave(id);
      if (kind === "OVERTIME") await approveOvertime(id);
      if (kind === "SHIFT") await approveShift(id);
      await loadAll({ append: false });
      if (autoAdvance && wasOverdue) {
        setPendingAutoJump(true);
      }
      setMsg(`${kind} request approved`);
    } catch (err) {
      setMsg(err?.response?.data?.message || `Failed to approve ${kind} request`);
    }
  };

  const doReject = async (kind, id, wasOverdue = false) => {
    const reason = prompt("Rejection reason") || "Rejected";
    try {
      if (kind === "LEAVE") await rejectLeave(id, reason);
      if (kind === "OVERTIME") await rejectOvertime(id, reason);
      if (kind === "SHIFT") await rejectShift(id, reason);
      await loadAll({ append: false });
      if (autoAdvance && wasOverdue) {
        setPendingAutoJump(true);
      }
      setMsg(`${kind} request rejected`);
    } catch (err) {
      setMsg(err?.response?.data?.message || `Failed to reject ${kind} request`);
    }
  };

  const savePolicy = async (requestType) => {
    const edit = policyEdits[requestType];
    if (!edit) return;
    setSavingPolicy(true);
    try {
      await updateWorkforceSlaPolicy(requestType, {
        targetMinutes: Number(edit.targetMinutes),
        escalationMinutes: Number(edit.escalationMinutes),
        active: Boolean(edit.active),
      });
      await loadAll({ append: false });
      setMsg(`${requestType} SLA policy updated`);
    } catch (err) {
      setMsg(err?.response?.data?.message || `Failed to update ${requestType} policy`);
    } finally {
      setSavingPolicy(false);
    }
  };

  const saveAutomation = async (requestType) => {
    const edit = automationEdits[requestType];
    if (!edit) return;
    setSavingAutomation(true);
    try {
      await updateWorkforceAutomationPolicy(requestType, {
        active: Boolean(edit.active),
        autoApprove: Boolean(edit.autoApprove),
        requireSecondApprover: Boolean(edit.requireSecondApprover),
        fallbackRole: String(edit.fallbackRole || "").toUpperCase(),
        escalationAfterMinutes: Number(edit.escalationAfterMinutes || 120),
        conditions: {
          maxLeaveDays: Number(edit.conditions?.maxLeaveDays || 0),
          maxOvertimeHours: Number(edit.conditions?.maxOvertimeHours || 0),
          priorityAgeMultiplier: Number(edit.conditions?.priorityAgeMultiplier ?? 1),
          priorityWeightCap: Number(edit.conditions?.priorityWeightCap ?? 5),
          allowedShiftTypes: String(edit.conditions?.allowedShiftTypes || "")
            .split(",")
            .map((v) => v.trim().toUpperCase())
            .filter(Boolean),
          fallbackCandidates: String(edit.conditions?.fallbackCandidates || "")
            .split(",")
            .map((v) => v.trim().toUpperCase())
            .filter(Boolean),
        },
      });
      await loadAll();
      setMsg(`${requestType} automation policy updated`);
    } catch (err) {
      setMsg(err?.response?.data?.message || `Failed to update ${requestType} automation`);
    } finally {
      setSavingAutomation(false);
    }
  };

  const runSweep = async () => {
    try {
      const res = await runWorkforceAutomationSweep();
      const t = res?.data?.escalated?.total ?? 0;
      setMsg(`Automation sweep completed. Escalated: ${t}`);
      await loadAll();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Automation sweep failed");
    }
  };

  const applyPresetAll = async (presetKey) => {
    if (!presetKey) return;
    setSavingAutomation(true);
    try {
      await applyWorkforceAutomationPresetAll(presetKey);
      await loadAll({ append: false });
      setMsg(`Applied ${presetKey} preset to all request types`);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to apply preset to all");
    } finally {
      setSavingAutomation(false);
    }
  };

  const saveCustomPreset = async () => {
    setSavingAutomation(true);
    try {
      await upsertWorkforceAutomationPreset(customPreset);
      await loadAll({ append: false });
      setMsg(`Custom preset ${customPreset.key || customPreset.name} saved`);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to save custom preset");
    } finally {
      setSavingAutomation(false);
    }
  };

  const clonePresetToForm = (preset) => {
    if (!preset) return;
    const cfg = preset.config || {};
    setCustomPreset({
      key: String(preset.key || "").toUpperCase(),
      name: preset.name || "",
      description: preset.description || "",
      config: {
        active: cfg.active !== false,
        autoApprove: cfg.autoApprove === true,
        requireSecondApprover: cfg.requireSecondApprover !== false,
        fallbackRole: cfg.fallbackRole || "AUTO",
        escalationAfterMinutes: Number(cfg.escalationAfterMinutes || 120),
        conditions: {
          priorityAgeMultiplier: Number(cfg.conditions?.priorityAgeMultiplier ?? 1),
          priorityWeightCap: Number(cfg.conditions?.priorityWeightCap ?? 5),
        },
      },
    });
  };

  const deactivateCustomPreset = async (key) => {
    if (!key) return;
    setSavingAutomation(true);
    try {
      await deactivateWorkforceAutomationPreset(key);
      await loadAll({ append: false });
      setMsg(`Custom preset ${key} deactivated`);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to deactivate custom preset");
    } finally {
      setSavingAutomation(false);
    }
  };

  const reactivateCustomPreset = async (key) => {
    if (!key) return;
    setSavingAutomation(true);
    try {
      await reactivateWorkforceAutomationPreset(key);
      await loadAll({ append: false });
      setMsg(`Custom preset ${key} reactivated`);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to reactivate custom preset");
    } finally {
      setSavingAutomation(false);
    }
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await previewWorkforceEscalation({ limit: 100 });
      setPreviewResult(res?.data || null);
      setMsg("Escalation preview generated");
    } catch (err) {
      setMsg(err?.response?.data?.message || "Escalation preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const simulatePolicy = async (requestType) => {
    const edit = automationEdits[requestType];
    if (!edit) return;
    const sample =
      requestType === "LEAVE"
        ? { startDate: new Date().toISOString(), endDate: new Date().toISOString() }
        : requestType === "OVERTIME"
        ? { hours: Number(edit.conditions?.maxOvertimeHours || 1) }
        : { shiftType: String(edit.conditions?.allowedShiftTypes || "DAY").split(",")[0]?.trim() || "DAY" };
    try {
      const res = await simulateWorkforceAutomation({ requestType, sample });
      setSimResult({ requestType, ...res.data });
      setMsg(`${requestType} simulation ran`);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Simulation failed");
    }
  };

  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = String(el.tagName || "").toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };

    const onKeyDown = async (e) => {
      if (isTypingTarget(e.target)) return;
      const key = String(e.key || "").toLowerCase();
      if (!["j", "a", "r", "u", "f"].includes(key)) return;
      e.preventDefault();

      if (key === "f") {
        filterRef.current?.focus();
        return;
      }

      if (key === "u") {
        setViewMode((v) => (v === "BREACHED" ? "ALL" : "BREACHED"));
        return;
      }

      if (key === "j") {
        jumpToNextBreached();
        return;
      }

      const target = getActiveBreachRow();
      if (!target) return;

      if (key === "a") {
        await doApprove(target.kind, target._id, true);
        return;
      }
      if (key === "r") {
        await doReject(target.kind, target._id, true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [breachedRows, activeBreachKey, autoAdvance, breachCursor]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Workforce Approvals</h2>
          <p className="muted">Leave, overtime and shift approvals with SLA monitoring.</p>
        </div>
        <div className="welcome-actions">
          <span className="triage-shortcuts">
            Shortcuts: J next • A approve • R reject • U breached only • F filter
          </span>
          <input
            ref={filterRef}
            className="triage-filter-input"
            placeholder="Filter staff, role, type, reason..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            className={`btn-secondary ${autoAdvance ? "active" : ""}`}
            onClick={() => setAutoAdvance((v) => !v)}
            title="When enabled, approving/rejecting a breached item moves focus to the next breached item."
          >
            Auto-Advance: {autoAdvance ? "On" : "Off"}
          </button>
          <button
            className="btn-secondary"
            onClick={jumpToNextBreached}
            disabled={!breachedRows.length}
            title={breachedRows.length ? "Jump to next overdue request" : "No breached rows"}
          >
            Jump to Next Breached {breachedRows.length ? `(${breachedRows.length})` : ""}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setViewMode((v) => (v === "BREACHED" ? "ALL" : "BREACHED"))}
          >
            {viewMode === "BREACHED" ? "Show All" : "Show Breached Only"}
          </button>
          <select
            value={queueKindFilter}
            onChange={(e) => setQueueKindFilter(e.target.value)}
            title="Filter pending table by request type"
          >
            <option value="ALL">All Queues</option>
            <option value="LEAVE">Leave</option>
            <option value="OVERTIME">Overtime</option>
            <option value="SHIFT">Shift</option>
          </select>
          <button className="btn-secondary" onClick={() => loadAll({ append: false })} disabled={loading}>
            Refresh
          </button>
          <button className="btn-secondary" onClick={resetView} disabled={loading}>
            Reset View
          </button>
          <span className="muted">{cacheBadge}</span>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Queue Insights</h3>
        <div className="grid info-grid">
          <div className="card stat">
            <div className="card-title">Pending</div>
            <div className="card-value">{queue?.totals?.pending ?? "—"}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Breached</div>
            <div className="card-value">{queue?.totals?.breached ?? "—"}</div>
          </div>
          <div className="card stat">
            <div className="card-title">L2 Pending</div>
            <div className="card-value">{queue?.totals?.l2Pending ?? "—"}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Approved</div>
            <div className="card-value">{queue?.totals?.approved ?? "—"}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Rejected</div>
            <div className="card-value">{queue?.totals?.rejected ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="section" id="sla">
        <h3>SLA Policies</h3>
        <div className="card">
          <table className="table lite">
            <thead>
              <tr>
                <th>Request Type</th>
                <th>Target (mins)</th>
                <th>Escalation (mins)</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((row) => {
                const edit = policyEdits[row.requestType] || {};
                return (
                  <tr key={row.requestType}>
                    <td>{row.requestType}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={edit.targetMinutes ?? ""}
                        onChange={(e) =>
                          setPolicyEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              targetMinutes: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={edit.escalationMinutes ?? ""}
                        onChange={(e) =>
                          setPolicyEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              escalationMinutes: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(edit.active)}
                        onChange={(e) =>
                          setPolicyEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              active: e.target.checked,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        disabled={savingPolicy}
                        onClick={() => savePolicy(row.requestType)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
              {policies.length === 0 && (
                <tr>
                  <td colSpan="5">No SLA policies loaded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" id="automation">
        <h3>Automation Policies</h3>
        <div className="card">
          <div className="welcome-actions" style={{ marginBottom: 10 }}>
            <button className="btn-secondary" onClick={runSweep}>
              Run Escalation Sweep
            </button>
            <button className="btn-secondary" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? "Previewing..." : "Preview Escalation Plan"}
            </button>
            {automationPresets.map((preset) => (
              <button
                key={`preset-all-${preset.key}`}
                className="btn-secondary"
                disabled={savingAutomation}
                title={`${preset.description || ""}${preset.version ? ` | v${preset.version}` : ""}`}
                onClick={() => applyPresetAll(preset.key)}
              >
                Apply {preset.name || preset.key} to all
              </button>
            ))}
            <button
              className="btn-secondary"
              onClick={() => setShowInactivePresets((v) => !v)}
            >
              {showInactivePresets ? "Hide Inactive Presets" : "Show Inactive Presets"}
            </button>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <strong>Preset Catalog</strong>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table lite">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Name</th>
                    <th>Source</th>
                    <th>Version</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {automationPresets.map((preset) => {
                    const isCustom = preset.source === "CUSTOM";
                    return (
                      <tr key={`preset-row-${preset.key}`}>
                        <td>{preset.key}</td>
                        <td>{preset.name || "-"}</td>
                        <td>{preset.source || "SYSTEM"}</td>
                        <td>{preset.version || 1}</td>
                        <td>
                          <button
                            className="btn-secondary"
                            onClick={() => clonePresetToForm(preset)}
                          >
                            Clone to Form
                          </button>
                          {isCustom && preset.active !== false && canManagePresetLifecycle && (
                            <button
                              className="btn-danger"
                              disabled={savingAutomation}
                              onClick={() => deactivateCustomPreset(preset.key)}
                            >
                              Deactivate
                            </button>
                          )}
                          {isCustom && preset.active === false && canManagePresetLifecycle && (
                            <button
                              className="btn-secondary"
                              disabled={savingAutomation}
                              onClick={() => reactivateCustomPreset(preset.key)}
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {automationPresets.length === 0 && (
                    <tr>
                      <td colSpan="5">No presets available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <strong>Create/Update Custom Preset</strong>
            <div className="grid info-grid" style={{ marginTop: 10 }}>
              <label>
                Key
                <input
                  type="text"
                  placeholder="e.g. NIGHT_SHIFT_RUSH"
                  value={customPreset.key}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                    }))
                  }
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  placeholder="Human readable name"
                  value={customPreset.name}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  placeholder="When to use this preset"
                  value={customPreset.description}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Escalate After (min)
                <input
                  type="number"
                  min="5"
                  max="10080"
                  value={customPreset.config.escalationAfterMinutes}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        escalationAfterMinutes: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label>
                Fallback Role
                <select
                  value={customPreset.config.fallbackRole}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        fallbackRole: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="AUTO">AUTO</option>
                  <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN</option>
                  <option value="HR_MANAGER">HR_MANAGER</option>
                  <option value="PAYROLL_OFFICER">PAYROLL_OFFICER</option>
                  <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </label>
              <label>
                Priority Age Multiplier
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={customPreset.config.conditions.priorityAgeMultiplier}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        conditions: {
                          ...prev.config.conditions,
                          priorityAgeMultiplier: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                Priority Weight Cap
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="0.1"
                  value={customPreset.config.conditions.priorityWeightCap}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        conditions: {
                          ...prev.config.conditions,
                          priorityWeightCap: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(customPreset.config.autoApprove)}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      config: { ...prev.config, autoApprove: e.target.checked },
                    }))
                  }
                />
                Auto-Approve
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(customPreset.config.requireSecondApprover)}
                  onChange={(e) =>
                    setCustomPreset((prev) => ({
                      ...prev,
                      config: { ...prev.config, requireSecondApprover: e.target.checked },
                    }))
                  }
                />
                Require 2nd Approver
              </label>
            </div>
            <div className="welcome-actions" style={{ marginTop: 10 }}>
              <button
                className="btn-secondary"
                disabled={savingAutomation}
                onClick={saveCustomPreset}
              >
                Save Custom Preset
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  setCustomPreset({
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
                  })
                }
              >
                Reset Form
              </button>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <strong>Preset Usage History</strong>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table lite">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Preset</th>
                    <th>Actor</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {presetHistory.map((row) => (
                    <tr key={`preset-history-${row.id}`}>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                      <td>{row.action}</td>
                      <td>{row.presetKey || "-"}</td>
                      <td>{row.actor?.name || row.actor?.email || "-"}</td>
                      <td>{row.actor?.role || "-"}</td>
                    </tr>
                  ))}
                  {presetHistory.length === 0 && (
                    <tr>
                      <td colSpan="5">No preset usage history yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {previewResult && (
            <div className="card" style={{ marginBottom: 10 }}>
              <strong>
                Escalation Preview • Candidates: {previewResult?.totals?.totalCandidates ?? 0}
              </strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Generated:{" "}
                {previewResult?.generatedAt
                  ? new Date(previewResult.generatedAt).toLocaleString()
                  : "-"}
              </div>
              <div className="grid info-grid" style={{ marginTop: 10 }}>
                {(previewResult?.previews || []).map((row) => (
                  <div className="card stat" key={`preview-${row.requestType}`}>
                    <div className="card-title">{row.requestType}</div>
                    <div className="card-value">{row.totalCandidates || 0}</div>
                    <div className="muted">
                      {row.eligible
                        ? `Fallback: ${row.fallbackRole || "-"} (${row.fallbackMode || "FIXED"})`
                        : `Ineligible: ${row.reason || "N/A"}`}
                    </div>
                    {row.eligible && (
                      <div className="muted">
                        Weighted demand: {row.weightedCandidates ?? 0}
                      </div>
                    )}
                    {row.eligible && row.priorityTuning && (
                      <div className="muted">
                        Tuning: age x{row.priorityTuning.priorityAgeMultiplier ?? 1}, cap{" "}
                        {row.priorityTuning.priorityWeightCap ?? 5}
                      </div>
                    )}
                    {Array.isArray(row.roleForecast) && row.roleForecast.length > 0 && (
                      <div className="muted" style={{ marginTop: 8 }}>
                        {row.roleForecast.map((f) => (
                          <div key={`${row.requestType}-${f.role}`}>
                            {f.role}: now {f.currentPendingAssignments} (+age {f.currentAvgPendingAgeMinutes}m)
                            {" "} / +{f.projectedAssignments} (w {f.projectedWeightedAssignments}) →{" "}
                            {f.projectedAvgPendingPerUser}/user, pressure {f.projectedPriorityPressure}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <table className="table lite">
            <thead>
              <tr>
                <th>Request Type</th>
                <th>Policy Active</th>
                <th>Auto-Approve</th>
                <th>2nd Approver</th>
                <th>Fallback Role</th>
                <th>Escalate After (min)</th>
                <th>Max Leave Days</th>
                <th>Max Overtime Hours</th>
                <th>Priority Age Multiplier</th>
                <th>Priority Weight Cap</th>
                <th>Allowed Shift Types (comma)</th>
                <th>Fallback Candidates (comma roles)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {automationPolicies.map((row) => {
                const edit = automationEdits[row.requestType] || {};
                return (
                  <tr key={`auto-${row.requestType}`}>
                    <td>{row.requestType}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(edit.active)}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              active: e.target.checked,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(edit.autoApprove)}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              autoApprove: e.target.checked,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(edit.requireSecondApprover)}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              requireSecondApprover: e.target.checked,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={edit.fallbackRole || "HOSPITAL_ADMIN"}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              fallbackRole: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="AUTO">AUTO (workload-aware)</option>
                        <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN</option>
                        <option value="HR_MANAGER">HR_MANAGER</option>
                        <option value="PAYROLL_OFFICER">PAYROLL_OFFICER</option>
                        <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="5"
                        max="10080"
                        value={edit.escalationAfterMinutes ?? 120}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              escalationAfterMinutes: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={edit.conditions?.maxLeaveDays ?? 0}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              conditions: {
                                ...(prev[row.requestType]?.conditions || {}),
                                maxLeaveDays: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={edit.conditions?.maxOvertimeHours ?? 0}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              conditions: {
                                ...(prev[row.requestType]?.conditions || {}),
                                maxOvertimeHours: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={edit.conditions?.priorityAgeMultiplier ?? 1}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              conditions: {
                                ...(prev[row.requestType]?.conditions || {}),
                                priorityAgeMultiplier: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="0.1"
                        value={edit.conditions?.priorityWeightCap ?? 5}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              conditions: {
                                ...(prev[row.requestType]?.conditions || {}),
                                priorityWeightCap: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={edit.conditions?.allowedShiftTypes ?? ""}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              conditions: {
                                ...(prev[row.requestType]?.conditions || {}),
                                allowedShiftTypes: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={edit.conditions?.fallbackCandidates ?? ""}
                        onChange={(e) =>
                          setAutomationEdits((prev) => ({
                            ...prev,
                            [row.requestType]: {
                              ...prev[row.requestType],
                              conditions: {
                                ...(prev[row.requestType]?.conditions || {}),
                                fallbackCandidates: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <div className="action-list" style={{ marginBottom: 8 }}>
                        {automationPresets.map((preset) => (
                          <button
                            key={`preset-row-${row.requestType}-${preset.key}`}
                            className="btn-secondary"
                            title={`${preset.description || ""}${preset.version ? ` | v${preset.version}` : ""}`}
                            onClick={() => applyAutomationPreset(row.requestType, preset.key)}
                          >
                            {preset.name || preset.key}
                          </button>
                        ))}
                      </div>
                      <button
                        className="btn-secondary"
                        disabled={savingAutomation}
                        onClick={() => saveAutomation(row.requestType)}
                      >
                        Save
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => simulatePolicy(row.requestType)}
                      >
                        Simulate
                      </button>
                    </td>
                  </tr>
                );
              })}
              {automationPolicies.length === 0 && (
                <tr>
                  <td colSpan="13">No automation policies loaded</td>
                </tr>
              )}
            </tbody>
          </table>
          {simResult && (
            <div className="card" style={{ marginTop: 10 }}>
              <strong>Simulation ({simResult.requestType})</strong>
              <div className="muted">
                Auto-Approve: {simResult?.decision?.autoApprove ? "Yes" : "No"} | Requires 2nd Approver: {simResult?.decision?.requiresSecondApprover ? "Yes" : "No"} | Fallback: {simResult?.decision?.fallbackRole || "-"}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section" id="pending">
        <h3>Pending Requests</h3>
        <div className="card">
          <div className="action-list" style={{ marginBottom: 12 }}>
            <button
              className={`action-pill ${queueKindFilter === "ALL" ? "active" : ""}`}
              onClick={() => setQueueKindFilter("ALL")}
            >
              All
            </button>
            <button
              className={`action-pill ${queueKindFilter === "LEAVE" ? "active" : ""}`}
              onClick={() => setQueueKindFilter("LEAVE")}
            >
              Leave
            </button>
            <button
              className={`action-pill ${queueKindFilter === "OVERTIME" ? "active" : ""}`}
              onClick={() => setQueueKindFilter("OVERTIME")}
            >
              Overtime
            </button>
            <button
              className={`action-pill ${queueKindFilter === "SHIFT" ? "active" : ""}`}
              onClick={() => setQueueKindFilter("SHIFT")}
            >
              Shift
            </button>
          </div>
          <div className="action-list" style={{ marginBottom: 12 }}>
            <span className="muted">
              Leave: {pendingByKind.LEAVE}
              {queue?.queues?.leave?.pending != null
                ? ` / total ${queue.queues.leave.pending}`
                : ""}
            </span>
            <button
              className="btn-secondary"
              disabled={!hasMoreLeave || loadingMoreKind === "LEAVE"}
              onClick={() => loadMoreByKind("LEAVE")}
            >
              {loadingMoreKind === "LEAVE" ? "Loading..." : "Load more Leave"}
            </button>
            <span className="muted">
              Overtime: {pendingByKind.OVERTIME}
              {queue?.queues?.overtime?.pending != null
                ? ` / total ${queue.queues.overtime.pending}`
                : ""}
            </span>
            <button
              className="btn-secondary"
              disabled={!hasMoreOvertime || loadingMoreKind === "OVERTIME"}
              onClick={() => loadMoreByKind("OVERTIME")}
            >
              {loadingMoreKind === "OVERTIME" ? "Loading..." : "Load more Overtime"}
            </button>
            <span className="muted">
              Shift: {pendingByKind.SHIFT}
              {queue?.queues?.shift?.pending != null
                ? ` / total ${queue.queues.shift.pending}`
                : ""}
            </span>
            <button
              className="btn-secondary"
              disabled={!hasMoreShift || loadingMoreKind === "SHIFT"}
              onClick={() => loadMoreByKind("SHIFT")}
            >
              {loadingMoreKind === "SHIFT" ? "Loading..." : "Load more Shift"}
            </button>
            <button
              className="btn-secondary"
              disabled={loadingMore}
              onClick={() => loadAll({ append: true })}
            >
              {loadingMore ? "Loading..." : "Load more All"}
            </button>
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Role</th>
                <th>Type</th>
                <th>Category</th>
                <th>Requested</th>
                <th>SLA Due</th>
                <th>Stage</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((item) => (
                <tr
                  id={`breach-row-${item.kind}-${item._id}`}
                  key={`${item.kind}-${item._id}`}
                  className={[
                    isOverdue(item) ? "breached-row" : "",
                    activeBreachKey === `${item.kind}-${item._id}`
                      ? "breached-row-active"
                      : "",
                  ]
                    .join(" ")
                    .trim()}
                >
                  <td>{item.requester?.name || "-"}</td>
                  <td>{item.requester?.role || "-"}</td>
                  <td>{item.kind}</td>
                  <td>{item.type || item.shiftType || `${item.hours || "-"} hrs`}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td className={isOverdue(item) ? "text-danger" : ""}>
                    {item.slaDueAt ? new Date(item.slaDueAt).toLocaleString() : "-"}
                    {isOverdue(item) && <span className="breach-pill">BREACHED</span>}
                  </td>
                  <td>{item.approvalStage || "L1_PENDING"}</td>
                  <td>{item.reason || "-"}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => doApprove(item.kind, item._id, isOverdue(item))}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => doReject(item.kind, item._id, isOverdue(item))}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {pendingRows.length === 0 && (
                <tr>
                  <td colSpan="9">No pending approvals</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
