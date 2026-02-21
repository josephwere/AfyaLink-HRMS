import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import {
  createLeave,
  createOvertime,
  createShift,
  listMyLeave,
  listMyOvertime,
  listMyShifts,
} from "../../services/workforceApi";

const MY_REQUESTS_CACHE_KEY = "my_requests_query_cache_v1";
const MY_REQUESTS_CACHE_TTL_MS = 15 * 60 * 1000;

export default function MyRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [leave, setLeave] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaveCursor, setLeaveCursor] = useState(null);
  const [overtimeCursor, setOvertimeCursor] = useState(null);
  const [shiftCursor, setShiftCursor] = useState(null);
  const [hasMoreLeave, setHasMoreLeave] = useState(false);
  const [hasMoreOvertime, setHasMoreOvertime] = useState(false);
  const [hasMoreShift, setHasMoreShift] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheBadge, setCacheBadge] = useState("Live • now");
  const skipInitialNetworkLoadRef = useRef(false);

  const [leaveForm, setLeaveForm] = useState({
    type: "Annual",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [overtimeForm, setOvertimeForm] = useState({
    hours: "",
    date: "",
    reason: "",
  });
  const [shiftForm, setShiftForm] = useState({
    shiftType: "Day",
    date: "",
    reason: "",
  });
  const cacheScope = `${user?.role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;

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

  const loadAll = async (status = "ALL", { append = false } = {}) => {
    setLoading(true);
    setMsg(null);
    try {
      const queryStatus = status !== "ALL" ? status : undefined;
      const shouldFetchLeave = !append || (hasMoreLeave && Boolean(leaveCursor));
      const shouldFetchOvertime = !append || (hasMoreOvertime && Boolean(overtimeCursor));
      const shouldFetchShift = !append || (hasMoreShift && Boolean(shiftCursor));

      const [l, o, s] = await Promise.all([
        shouldFetchLeave
          ? listMyLeave(queryStatus, {
              limit: 25,
              cursorMode: true,
              cursor: append ? leaveCursor : undefined,
            })
          : Promise.resolve(null),
        shouldFetchOvertime
          ? listMyOvertime(queryStatus, {
              limit: 25,
              cursorMode: true,
              cursor: append ? overtimeCursor : undefined,
            })
          : Promise.resolve(null),
        shouldFetchShift
          ? listMyShifts(queryStatus, {
              limit: 25,
              cursorMode: true,
              cursor: append ? shiftCursor : undefined,
            })
          : Promise.resolve(null),
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
        setCacheBadge("Live • now");
      }
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MY_REQUESTS_CACHE_KEY);
      if (!raw) {
        setCacheBadge("Live • now");
        setCacheReady(true);
        return;
      }
      const all = JSON.parse(raw);
      const cached = all?.[cacheScope];
      if (!cached || typeof cached !== "object") {
        setCacheBadge("Live • now");
        setCacheReady(true);
        return;
      }
      const age = Date.now() - new Date(cached.updatedAt || 0).getTime();
      if (!Number.isFinite(age) || age < 0 || age > MY_REQUESTS_CACHE_TTL_MS) {
        setCacheBadge("Live • now");
        setCacheReady(true);
        return;
      }
      const ageMinutes = Math.max(0, Math.floor(age / 60000));
      if (cached.statusFilter) setStatusFilter(cached.statusFilter);
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
      setCacheBadge(`Cached • ${ageMinutes}m ago`);
      skipInitialNetworkLoadRef.current = true;
    } catch {
      // ignore cache restore errors
    } finally {
      setCacheReady(true);
    }
  }, [cacheScope]);

  useEffect(() => {
    if (!cacheReady) return;
    if (skipInitialNetworkLoadRef.current) {
      skipInitialNetworkLoadRef.current = false;
      return;
    }
    loadAll(statusFilter, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheReady, statusFilter]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const status = String(qs.get("status") || "").toUpperCase();
    if (["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      setStatusFilter(status);
    }
    const hash = window.location.hash;
    if (!hash) return;
    const target = document.getElementById(hash.replace("#", ""));
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }, [location.search]);

  useEffect(() => {
    if (!cacheReady) return;
    try {
      const raw = localStorage.getItem(MY_REQUESTS_CACHE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[cacheScope] = {
        statusFilter,
        leave,
        overtime,
        shifts,
        leaveCursor,
        overtimeCursor,
        shiftCursor,
        hasMoreLeave,
        hasMoreOvertime,
        hasMoreShift,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(MY_REQUESTS_CACHE_KEY, JSON.stringify(all));
    } catch {
      // ignore cache persist errors
    }
  }, [
    cacheReady,
    cacheScope,
    statusFilter,
    leave,
    overtime,
    shifts,
    leaveCursor,
    overtimeCursor,
    shiftCursor,
    hasMoreLeave,
    hasMoreOvertime,
    hasMoreShift,
  ]);

  const combined = useMemo(() => {
    const items = [
      ...leave.map((item) => ({ ...item, kind: "Leave" })),
      ...overtime.map((item) => ({ ...item, kind: "Overtime" })),
      ...shifts.map((item) => ({ ...item, kind: "Shift" })),
    ];
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [leave, overtime, shifts]);

  const submitLeave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await createLeave({
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      });
      setLeaveForm({ type: "Annual", startDate: "", endDate: "", reason: "" });
      await loadAll(statusFilter, { append: false });
      setMsg("✅ Leave request submitted");
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  };

  const submitOvertime = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await createOvertime({
        hours: Number(overtimeForm.hours),
        date: overtimeForm.date,
        reason: overtimeForm.reason,
      });
      setOvertimeForm({ hours: "", date: "", reason: "" });
      await loadAll(statusFilter, { append: false });
      setMsg("✅ Overtime request submitted");
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to submit overtime request");
    } finally {
      setLoading(false);
    }
  };

  const submitShift = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await createShift({
        shiftType: shiftForm.shiftType,
        date: shiftForm.date,
        reason: shiftForm.reason,
      });
      setShiftForm({ shiftType: "Day", date: "", reason: "" });
      await loadAll(statusFilter, { append: false });
      setMsg("✅ Shift request submitted");
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to submit shift request");
    } finally {
      setLoading(false);
    }
  };

  const filtered = combined.filter((item) => {
    if (statusFilter === "ALL") return true;
    return item.status === statusFilter;
  });

  const exportCsv = () => {
    const rows = [
      ["Type", "Category", "Status", "Requested", "Details"],
      ...filtered.map((item) => [
        item.kind,
        item.type || item.shiftType || `${item.hours} hrs`,
        item.status,
        item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-",
        item.reason || "",
      ]),
    ];

    const csv = rows
      .map((r) =>
        r
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "my-requests.csv";
    link.click();
  };

  const resetView = async () => {
    try {
      const raw = localStorage.getItem(MY_REQUESTS_CACHE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      delete all[cacheScope];
      localStorage.setItem(MY_REQUESTS_CACHE_KEY, JSON.stringify(all));
    } catch {
      // ignore cache clear errors
    }

    setStatusFilter("ALL");
    setLeave([]);
    setOvertime([]);
    setShifts([]);
    setLeaveCursor(null);
    setOvertimeCursor(null);
    setShiftCursor(null);
    setHasMoreLeave(false);
    setHasMoreOvertime(false);
    setHasMoreShift(false);
    await loadAll("ALL", { append: false });
    setCacheBadge("Live • now");
    setMsg("View reset and reloaded from server");
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>My Requests</h2>
          <p className="muted">
            Submit leave, overtime, or shift requests and track approvals.
          </p>
        </div>
        <div className="welcome-actions">
          <button
            className="btn-secondary"
            onClick={() => loadAll(statusFilter, { append: false })}
            disabled={loading}
          >
            Refresh
          </button>
          <button className="btn-secondary" onClick={resetView} disabled={loading}>
            Reset View
          </button>
          <span className="muted">{cacheBadge}</span>
          {(user?.role === "HOSPITAL_ADMIN" || user?.role === "SUPER_ADMIN") && (
            <button
              className="btn-primary"
              onClick={() => navigate("/hospital-admin/approvals")}
            >
              View Approvals
            </button>
          )}
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section" id="leave">
        <h3>Leave Request</h3>
        <form className="card form" onSubmit={submitLeave}>
          <select
            value={leaveForm.type}
            onChange={(e) =>
              setLeaveForm({ ...leaveForm, type: e.target.value })
            }
          >
            <option value="Annual">Annual</option>
            <option value="Sick">Sick</option>
            <option value="Study">Study</option>
            <option value="Maternity">Maternity</option>
            <option value="Paternity">Paternity</option>
            <option value="Compassionate">Compassionate</option>
          </select>
          <input
            type="date"
            value={leaveForm.startDate}
            onChange={(e) =>
              setLeaveForm({ ...leaveForm, startDate: e.target.value })
            }
            required
          />
          <input
            type="date"
            value={leaveForm.endDate}
            onChange={(e) =>
              setLeaveForm({ ...leaveForm, endDate: e.target.value })
            }
            required
          />
          <input
            placeholder="Reason (optional)"
            value={leaveForm.reason}
            onChange={(e) =>
              setLeaveForm({ ...leaveForm, reason: e.target.value })
            }
          />
          <button disabled={loading}>
            {loading ? "Submitting..." : "Submit Leave"}
          </button>
        </form>
      </section>

      <section className="section" id="overtime">
        <h3>Overtime Request</h3>
        <form className="card form" onSubmit={submitOvertime}>
          <input
            type="number"
            min="1"
            placeholder="Hours"
            value={overtimeForm.hours}
            onChange={(e) =>
              setOvertimeForm({ ...overtimeForm, hours: e.target.value })
            }
            required
          />
          <input
            type="date"
            value={overtimeForm.date}
            onChange={(e) =>
              setOvertimeForm({ ...overtimeForm, date: e.target.value })
            }
            required
          />
          <input
            placeholder="Reason (optional)"
            value={overtimeForm.reason}
            onChange={(e) =>
              setOvertimeForm({ ...overtimeForm, reason: e.target.value })
            }
          />
          <button disabled={loading}>
            {loading ? "Submitting..." : "Submit Overtime"}
          </button>
        </form>
      </section>

      <section className="section" id="shift">
        <h3>Shift Request</h3>
        <form className="card form" onSubmit={submitShift}>
          <select
            value={shiftForm.shiftType}
            onChange={(e) =>
              setShiftForm({ ...shiftForm, shiftType: e.target.value })
            }
          >
            <option value="Day">Day Shift</option>
            <option value="Night">Night Shift</option>
            <option value="On-Call">On-Call</option>
            <option value="Weekend">Weekend</option>
          </select>
          <input
            type="date"
            value={shiftForm.date}
            onChange={(e) =>
              setShiftForm({ ...shiftForm, date: e.target.value })
            }
            required
          />
          <input
            placeholder="Reason (optional)"
            value={shiftForm.reason}
            onChange={(e) =>
              setShiftForm({ ...shiftForm, reason: e.target.value })
            }
          />
          <button disabled={loading}>
            {loading ? "Submitting..." : "Submit Shift"}
          </button>
        </form>
      </section>

      <section className="section">
        <h3>My Recent Requests</h3>
        <div className="card">
          <div className="action-list" style={{ marginBottom: 12 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button className="btn-secondary" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item._id}>
                  <td>{item.kind}</td>
                  <td>{item.type || item.shiftType || `${item.hours} hrs`}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>{item.reason || "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5">No requests yet</td>
                </tr>
              )}
            </tbody>
          </table>
          {(hasMoreLeave || hasMoreOvertime || hasMoreShift) && (
            <div style={{ marginTop: 12 }}>
              <button
                className="btn-secondary"
                disabled={loading}
                onClick={() => loadAll(statusFilter, { append: true })}
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
