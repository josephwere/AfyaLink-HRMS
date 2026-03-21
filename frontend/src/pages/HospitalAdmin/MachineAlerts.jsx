import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";

const PAGE_SIZE = 20;

function prettyTime(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function severityClass(severity) {
  const s = String(severity || "LOW").toUpperCase();
  if (s === "HIGH") return "risk";
  if (s === "MEDIUM") return "warn";
  return "good";
}

function ageMinutes(ts) {
  if (!ts) return 0;
  const ms = Date.now() - new Date(ts).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : 0;
}

export default function MachineAlerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [reasonById, setReasonById] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    read: "ALL",
    severity: "ALL",
  });
  const [autoEscalation, setAutoEscalation] = useState({
    highAfterMinutes: 0,
    mediumAfterMinutes: 0,
    dedupCooldownMinutes: 0,
    l1Roles: [],
    l2Roles: [],
    requireReasonForHighSeverityActions: false,
  });
  const [policyDraft, setPolicyDraft] = useState({
    highAfterMinutes: 15,
    mediumAfterMinutes: 60,
    dedupCooldownMinutes: 10,
    l1RolesText: "HOSPITAL_ADMIN,DEVELOPER",
    l2RolesText: "SYSTEM_ADMIN,SUPER_ADMIN,DEVELOPER",
    onCallPrimaryUserIds: [],
    onCallSecondaryUserIds: [],
    requireReasonForHighSeverityActions: false,
  });
  const [staffOptions, setStaffOptions] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestData, setManifestData] = useState(null);
  const [manifestVerifyLoading, setManifestVerifyLoading] = useState(false);
  const [manifestVerifyResult, setManifestVerifyResult] = useState(null);
  const alertsSectionRef = useRef(null);

  const load = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setMsg("");
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(PAGE_SIZE),
        });
        if (filters.read === "READ") params.set("read", "true");
        if (filters.read === "UNREAD") params.set("read", "false");
        if (filters.severity !== "ALL") params.set("severity", filters.severity);
        const data = await apiFetch(`/api/machine-connectivity/alerts?${params.toString()}`);
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total || 0));
        setPage(Number(data?.page || nextPage));
        const p = data?.autoEscalation || { highAfterMinutes: 0, mediumAfterMinutes: 0 };
        setAutoEscalation(p);
        setPolicyDraft({
          highAfterMinutes: Number(p.highAfterMinutes || 0),
          mediumAfterMinutes: Number(p.mediumAfterMinutes || 0),
          dedupCooldownMinutes: Number(p.dedupCooldownMinutes || 0),
          l1RolesText: Array.isArray(p.l1Roles) ? p.l1Roles.join(",") : "HOSPITAL_ADMIN,DEVELOPER",
          l2RolesText: Array.isArray(p.l2Roles) ? p.l2Roles.join(",") : "SYSTEM_ADMIN,SUPER_ADMIN,DEVELOPER",
          onCallPrimaryUserIds: Array.isArray(p.onCallPrimaryUserIds) ? p.onCallPrimaryUserIds.map(String) : [],
          onCallSecondaryUserIds: Array.isArray(p.onCallSecondaryUserIds) ? p.onCallSecondaryUserIds.map(String) : [],
          requireReasonForHighSeverityActions: Boolean(p.requireReasonForHighSeverityActions),
        });
      } catch (e) {
        setMsg(e?.message || "Failed to load machine alerts");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [filters.read, filters.severity, page]
  );

  useEffect(() => {
    load(1);
  }, [filters.read, filters.severity]);

  useEffect(() => {
    apiFetch("/api/hospital-admin/staff")
      .then((rows) => setStaffOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setStaffOptions([]));
  }, []);

  const acknowledge = async (id) => {
    setActionBusyId(id);
    setMsg("");
    try {
      const row = items.find((x) => x._id === id);
      const reason = String(reasonById[id] || "").trim();
      if (
        autoEscalation.requireReasonForHighSeverityActions &&
        String(row?.severity || "").toUpperCase() === "HIGH" &&
        !reason
      ) {
        setMsg("Reason is required to acknowledge high severity alerts.");
        return;
      }
      await apiFetch(`/api/machine-connectivity/alerts/${id}/ack`, {
        method: "PATCH",
        body: { reason },
      });
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, read: true } : x)));
      setReasonById((prev) => ({ ...prev, [id]: "" }));
    } catch (e) {
      setMsg(e?.message || "Failed to acknowledge alert");
    } finally {
      setActionBusyId("");
    }
  };

  const escalate = async (id) => {
    setActionBusyId(id);
    setMsg("");
    try {
      const row = items.find((x) => x._id === id);
      const reason = String(reasonById[id] || "").trim();
      if (
        autoEscalation.requireReasonForHighSeverityActions &&
        String(row?.severity || "").toUpperCase() === "HIGH" &&
        !reason
      ) {
        setMsg("Reason is required to escalate high severity alerts.");
        return;
      }
      const data = await apiFetch(`/api/machine-connectivity/alerts/${id}/escalate`, {
        method: "POST",
        body: { reason },
      });
      setItems((prev) =>
        prev.map((x) =>
          x._id === id ? { ...x, meta: { ...(x.meta || {}), escalated: true } } : x
        )
      );
      setMsg(`Alert escalated to ${Number(data?.recipients || 0)} recipients.`);
      setReasonById((prev) => ({ ...prev, [id]: "" }));
    } catch (e) {
      setMsg(e?.message || "Failed to escalate alert");
    } finally {
      setActionBusyId("");
    }
  };

  const acknowledgeVisible = async () => {
    setActionBusyId("bulk");
    setMsg("");
    try {
      const ids = items.filter((x) => !x.read).map((x) => x._id);
      if (!ids.length) {
        setMsg("No unread alerts on this page.");
        return;
      }
      const hasHighUnread = items.some(
        (x) => !x.read && String(x.severity || "").toUpperCase() === "HIGH"
      );
      const reason = String(bulkReason || "").trim();
      if (autoEscalation.requireReasonForHighSeverityActions && hasHighUnread && !reason) {
        setMsg("Reason is required for bulk acknowledgement when high severity alerts are included.");
        return;
      }
      const data = await apiFetch("/api/machine-connectivity/alerts/ack-bulk", {
        method: "PATCH",
        body: { ids, reason },
      });
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setMsg(`Acknowledged ${Number(data?.modified || 0)} alert(s).`);
      setBulkReason("");
    } catch (e) {
      setMsg(e?.message || "Failed to acknowledge visible alerts");
    } finally {
      setActionBusyId("");
    }
  };

  const savePolicy = async (e) => {
    e.preventDefault();
    setActionBusyId("policy");
    setMsg("");
    try {
      const payload = {
        highAfterMinutes: Number(policyDraft.highAfterMinutes),
        mediumAfterMinutes: Number(policyDraft.mediumAfterMinutes),
        dedupCooldownMinutes: Number(policyDraft.dedupCooldownMinutes),
        l1Roles: String(policyDraft.l1RolesText || "")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean),
        l2Roles: String(policyDraft.l2RolesText || "")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean),
        onCallPrimaryUserIds: policyDraft.onCallPrimaryUserIds || [],
        onCallSecondaryUserIds: policyDraft.onCallSecondaryUserIds || [],
        requireReasonForHighSeverityActions: Boolean(policyDraft.requireReasonForHighSeverityActions),
      };
      const data = await apiFetch("/api/machine-connectivity/alerts/policy", {
        method: "PUT",
        body: payload,
      });
      const p = data?.policy || payload;
      setAutoEscalation(p);
      setPolicyDraft({
        highAfterMinutes: Number(p.highAfterMinutes || 0),
        mediumAfterMinutes: Number(p.mediumAfterMinutes || 0),
        dedupCooldownMinutes: Number(p.dedupCooldownMinutes || 0),
        l1RolesText: Array.isArray(p.l1Roles) ? p.l1Roles.join(",") : "",
        l2RolesText: Array.isArray(p.l2Roles) ? p.l2Roles.join(",") : "",
        onCallPrimaryUserIds: Array.isArray(p.onCallPrimaryUserIds) ? p.onCallPrimaryUserIds.map(String) : [],
        onCallSecondaryUserIds: Array.isArray(p.onCallSecondaryUserIds) ? p.onCallSecondaryUserIds.map(String) : [],
        requireReasonForHighSeverityActions: Boolean(p.requireReasonForHighSeverityActions),
      });
      setMsg("Escalation policy updated.");
    } catch (e2) {
      setMsg(e2?.message || "Failed to update escalation policy");
    } finally {
      setActionBusyId("");
    }
  };

  const openTimeline = async (id) => {
    setTimelineLoading(true);
    setMsg("");
    try {
      const data = await apiFetch(`/api/machine-connectivity/alerts/${id}/timeline`);
      setTimelineData(data || null);
    } catch (e) {
      setMsg(e?.message || "Failed to load alert timeline");
      setTimelineData(null);
    } finally {
      setTimelineLoading(false);
    }
  };

  const downloadTimelineCsv = async (alertId) => {
    try {
      const base = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${base}/api/machine-connectivity/alerts/${alertId}/timeline.csv`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to export timeline (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `machine-alert-${alertId}-timeline.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e?.message || "Failed to export timeline CSV");
    }
  };

  const downloadTimelinePdf = async (alertId) => {
    try {
      const base = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${base}/api/machine-connectivity/alerts/${alertId}/timeline.pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to export PDF (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `machine-alert-${alertId}-timeline.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e?.message || "Failed to export timeline PDF");
    }
  };

  const loadEvidenceManifest = async (alertId) => {
    setManifestLoading(true);
    setManifestVerifyResult(null);
    setMsg("");
    try {
      const data = await apiFetch(`/api/machine-connectivity/alerts/${alertId}/evidence-manifest`);
      setManifestData(data || null);
    } catch (e) {
      setMsg(e?.message || "Failed to load evidence manifest");
      setManifestData(null);
    } finally {
      setManifestLoading(false);
    }
  };

  const downloadEvidenceBundle = async (alertId) => {
    try {
      const base = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${base}/api/machine-connectivity/alerts/${alertId}/evidence-bundle`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to download evidence bundle (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `machine-alert-${alertId}-evidence-bundle.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e?.message || "Failed to download evidence bundle");
    }
  };

  const verifyManifest = async () => {
    setManifestVerifyLoading(true);
    setManifestVerifyResult(null);
    setMsg("");
    try {
      const payload = manifestData?.payload || null;
      const signature = manifestData?.signature || null;
      if (!payload || !signature) {
        setMsg("Manifest payload/signature not available.");
        return;
      }
      const data = await apiFetch("/api/machine-connectivity/alerts/verify-manifest", {
        method: "POST",
        body: { payload, signature },
      });
      setManifestVerifyResult(data || null);
    } catch (e) {
      setMsg(e?.message || "Failed to verify evidence manifest");
    } finally {
      setManifestVerifyLoading(false);
    }
  };

  const stats = useMemo(() => {
    const unread = items.filter((x) => !x.read).length;
    const high = items.filter((x) => String(x.severity || "").toUpperCase() === "HIGH").length;
    const escalated = items.filter((x) => x?.meta?.escalated).length;
    return { unread, high, escalated };
  }, [items]);

  const focusAlerts = () => {
    alertsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openOverview = (kind) => {
    if (kind === "unread") {
      setFilters((prev) => ({ ...prev, read: "UNREAD" }));
      focusAlerts();
      return;
    }
    if (kind === "high") {
      setFilters((prev) => ({ ...prev, severity: "HIGH" }));
      focusAlerts();
      return;
    }
    if (kind === "all") {
      setFilters({ read: "ALL", severity: "ALL" });
      focusAlerts();
      return;
    }
    const escalated = items.find((row) => Boolean(row?.meta?.escalated));
    if (escalated?._id) {
      openTimeline(escalated._id);
      focusAlerts();
      return;
    }
    setMsg("No escalated alerts are available on the current page.");
    focusAlerts();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Machine Alerts</h2>
          <p className="muted">
            Review machine and integration events, acknowledge resolved alerts, and escalate critical incidents.
          </p>
        </div>
        <div className="welcome-actions">
          <input
            type="text"
            placeholder="Bulk ACK reason (optional)"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={acknowledgeVisible}
            disabled={loading || actionBusyId === "bulk"}
          >
            {actionBusyId === "bulk" ? "Applying..." : "Ack Visible"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => load(page)} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="warning-card">{msg}</div> : null}

      <section className="section">
        <h3>Overview</h3>
        <div className="grid info-grid">
          <StatCard title="Unread on current page" value={stats.unread} status={severityClass("HIGH")} onClick={() => openOverview("unread")} />
          <StatCard title="High severity" value={stats.high} status={severityClass("HIGH")} onClick={() => openOverview("high")} />
          <div
            className="card stat stat-warn stat-clickable"
            role="button"
            tabIndex={0}
            onClick={() => openOverview("escalated")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openOverview("escalated");
            }}
          >
            <div className="card-title">Escalated</div>
            <div className="card-value">{stats.escalated}</div>
            <div className="card-sub">
              Auto escalate: High {autoEscalation.highAfterMinutes || 0}m, Medium {autoEscalation.mediumAfterMinutes || 0}m
            </div>
            <div className="card-sub">Dedup cooldown: {autoEscalation.dedupCooldownMinutes || 0}m</div>
            <div className="card-sub">
              On-call primary: {(autoEscalation.onCallPrimaryUserIds || []).length} • secondary: {(autoEscalation.onCallSecondaryUserIds || []).length}
            </div>
            <div className="card-sub">
              Reason required on high severity: {autoEscalation.requireReasonForHighSeverityActions ? "Yes" : "No"}
            </div>
          </div>
          <StatCard title="Total matched" value={total} onClick={() => openOverview("all")} />
        </div>
      </section>

      <section className="section" ref={alertsSectionRef}>
        <h3>Escalation Policy</h3>
        <form className="card form" onSubmit={savePolicy}>
          <div className="form-grid cols-3">
            <div>
              <label>High Severity Auto-Escalate (minutes)</label>
              <input
                type="number"
                min="0"
                max="10080"
                value={policyDraft.highAfterMinutes}
                onChange={(e) => setPolicyDraft((prev) => ({ ...prev, highAfterMinutes: e.target.value }))}
              />
            </div>
            <div>
              <label>Medium Severity Auto-Escalate (minutes)</label>
              <input
                type="number"
                min="0"
                max="10080"
                value={policyDraft.mediumAfterMinutes}
                onChange={(e) => setPolicyDraft((prev) => ({ ...prev, mediumAfterMinutes: e.target.value }))}
              />
            </div>
            <div>
              <label>Duplicate Alert Cooldown (minutes)</label>
              <input
                type="number"
                min="0"
                max="1440"
                value={policyDraft.dedupCooldownMinutes}
                onChange={(e) => setPolicyDraft((prev) => ({ ...prev, dedupCooldownMinutes: e.target.value }))}
              />
            </div>
            <div>
              <label>L1 Escalation Roles (comma-separated)</label>
              <input
                type="text"
                value={policyDraft.l1RolesText}
                onChange={(e) => setPolicyDraft((prev) => ({ ...prev, l1RolesText: e.target.value }))}
              />
            </div>
            <div>
              <label>L2 Escalation Roles (comma-separated)</label>
              <input
                type="text"
                value={policyDraft.l2RolesText}
                onChange={(e) => setPolicyDraft((prev) => ({ ...prev, l2RolesText: e.target.value }))}
              />
            </div>
            <div>
              <label>On-call Primary Users (L1)</label>
              <select
                multiple
                value={policyDraft.onCallPrimaryUserIds}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({
                    ...prev,
                    onCallPrimaryUserIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                  }))
                }
              >
                {staffOptions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>On-call Secondary Users (L2)</label>
              <select
                multiple
                value={policyDraft.onCallSecondaryUserIds}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({
                    ...prev,
                    onCallSecondaryUserIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                  }))
                }
              >
                {staffOptions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Require reason for high severity ACK/Escalate</label>
              <select
                value={policyDraft.requireReasonForHighSeverityActions ? "YES" : "NO"}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({
                    ...prev,
                    requireReasonForHighSeverityActions: e.target.value === "YES",
                  }))
                }
              >
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={actionBusyId === "policy"}>
            {actionBusyId === "policy" ? "Saving..." : "Save Policy"}
          </button>
        </form>
      </section>

      <section className="section">
        <h3>Filters</h3>
        <div className="card form">
          <div className="form-grid cols-3">
            <div>
              <label>Read Status</label>
              <select
                value={filters.read}
                onChange={(e) => setFilters((prev) => ({ ...prev, read: e.target.value }))}
              >
                <option value="ALL">All</option>
                <option value="UNREAD">Unread</option>
                <option value="READ">Read</option>
              </select>
            </div>
            <div>
              <label>Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
              >
                <option value="ALL">All</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Alerts</h3>
        <div className="card table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Title</th>
                <th>Details</th>
                <th>Severity</th>
                <th>SLA</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id}>
                  <td>{prettyTime(row.createdAt)}</td>
                  <td>{row.title || "Machine Alert"}</td>
                  <td>{row.body || "-"}</td>
                  <td>{String(row.severity || "LOW").toUpperCase()}</td>
                  <td>
                    {(() => {
                      const sev = String(row.severity || "LOW").toUpperCase();
                      const threshold =
                        sev === "HIGH" ? Number(autoEscalation.highAfterMinutes || 0) :
                        sev === "MEDIUM" ? Number(autoEscalation.mediumAfterMinutes || 0) : 0;
                      const age = ageMinutes(row.createdAt);
                      if (!threshold) return "No auto-SLA";
                      const left = threshold - age;
                      if (left <= 0) return row?.meta?.escalated ? "Escalated" : "Due";
                      return `${left}m left`;
                    })()}
                  </td>
                  <td>
                    {row.read ? "Read" : "Unread"}
                    {row?.meta?.escalated ? " • Escalated" : ""}
                    {row?.meta?.escalationLevel ? ` (${row.meta.escalationLevel})` : ""}
                  </td>
                  <td>
                    <div className="row-actions">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={reasonById[row._id] || ""}
                        onChange={(e) =>
                          setReasonById((prev) => ({ ...prev, [row._id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actionBusyId === row._id || row.read}
                        onClick={() => acknowledge(row._id)}
                      >
                        Ack
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actionBusyId === row._id || Boolean(row?.meta?.escalated)}
                        onClick={() => escalate(row._id)}
                      >
                        Escalate
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={timelineLoading}
                        onClick={() => openTimeline(row._id)}
                      >
                        Timeline
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={manifestLoading}
                        onClick={() => loadEvidenceManifest(row._id)}
                      >
                        Evidence
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="muted">
                    {loading ? "Loading..." : "No machine alerts found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => load(page - 1)}>
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
          >
            Next
          </button>
        </div>
      </section>

      {(timelineLoading || timelineData) && (
        <section className="section">
          <h3>Alert Timeline</h3>
          <div className="card">
            {timelineLoading && <div className="muted">Loading timeline…</div>}
            {!timelineLoading && timelineData && (
              <>
                <div className="row-actions" style={{ marginBottom: 12 }}>
                  <button type="button" className="btn-secondary" onClick={() => setTimelineData(null)}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => downloadTimelineCsv(timelineData?.alert?._id)}
                    disabled={!timelineData?.alert?._id}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => downloadTimelinePdf(timelineData?.alert?._id)}
                    disabled={!timelineData?.alert?._id}
                  >
                    Export PDF
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="doctor-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(timelineData?.events || []).map((ev, idx) => (
                        <tr key={`${ev.type}-${idx}-${ev.createdAt || ""}`}>
                          <td>{prettyTime(ev.createdAt)}</td>
                          <td>{ev.type}</td>
                          <td>{ev.message || "-"}</td>
                        </tr>
                      ))}
                      {!(timelineData?.events || []).length && (
                        <tr>
                          <td colSpan={3} className="muted">No timeline events.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {(manifestLoading || manifestData) && (
        <section className="section">
          <h3>Evidence Manifest</h3>
          <div className="card">
            {manifestLoading && <div className="muted">Loading evidence manifest…</div>}
            {!manifestLoading && manifestData && (
              <>
                <div className="row-actions" style={{ marginBottom: 12 }}>
                  <button type="button" className="btn-secondary" onClick={() => setManifestData(null)}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={verifyManifest}
                    disabled={manifestVerifyLoading || !manifestData?.payload || !manifestData?.signature}
                  >
                    {manifestVerifyLoading ? "Verifying..." : "Verify Signature"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => downloadEvidenceBundle(manifestData?.payload?.alertId)}
                    disabled={!manifestData?.payload?.alertId}
                  >
                    Download Bundle
                  </button>
                </div>
                {manifestVerifyResult ? (
                  <div className="card-sub" style={{ marginBottom: 12 }}>
                    Verification: {manifestVerifyResult.ok ? "Valid" : "Invalid"} •{" "}
                    {prettyTime(manifestVerifyResult.verifiedAt)}
                  </div>
                ) : null}
                <pre>{JSON.stringify(manifestData, null, 2)}</pre>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
