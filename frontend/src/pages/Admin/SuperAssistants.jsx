import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import {
  bulkUpdateSuperAssistants,
  listSuperAssistants,
  sendSuperAssistantResetLink,
  updateSuperAssistant,
} from "../../services/superAdminApi";
import { useAuth } from "../../utils/auth";

const STATUS_OPTIONS = ["ACTIVE", "SUSPENDED", "ON_LEAVE"];
const BULK_ACTIONS = [
  { value: "ENABLE", label: "Enable selected" },
  { value: "DISABLE", label: "Disable selected" },
  { value: "SET_STATUS", label: "Set operating status" },
  { value: "SEND_RESET_LINK", label: "Send invite/reset link" },
];

const coerceList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatProvider = (value) => {
  const provider = String(value || "local").toLowerCase();
  return provider === "google" ? "Google" : "Password";
};

const formatBucket = (value) => {
  const bucket = String(value || "").toUpperCase();
  const labels = {
    ACTIVE_TODAY: "Active today",
    ACTIVE_7D: "Active in 7d",
    STALE_30D: "Idle < 30d",
    DORMANT: "Dormant",
    NEVER_LOGGED_IN: "Never logged in",
  };
  return labels[bucket] || "Unknown";
};

function StatusPill({ active, status }) {
  const normalized = String(status || "ACTIVE").toUpperCase();
  const tone = !active || normalized === "SUSPENDED" ? "warn" : "ok";
  const label = !active ? "DISABLED" : normalized.replaceAll("_", " ");
  return <span className={`profile-status-pill ${tone}`}>{label}</span>;
}

function ActivityBadge({ bucket }) {
  const normalized = String(bucket || "NEVER_LOGGED_IN").toUpperCase();
  let tone = "subtle";
  if (normalized === "ACTIVE_TODAY" || normalized === "ACTIVE_7D") tone = "good";
  else if (normalized === "STALE_30D") tone = "warn";
  else if (normalized === "DORMANT") tone = "risk";
  return <span className={`assistant-badge ${tone}`}>{formatBucket(normalized)}</span>;
}

export default function SuperAssistants() {
  const { user } = useAuth();
  const actorRole = String(user?.role || "").toUpperCase();
  const canManage = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    disabled: 0,
    activeToday: 0,
    active7d: 0,
    neverLoggedIn: 0,
    pendingResets: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedRows, setSelectedRows] = useState({});
  const [bulkAction, setBulkAction] = useState("ENABLE");
  const [bulkStatus, setBulkStatus] = useState("ACTIVE");
  const [filters, setFilters] = useState({
    q: "",
    active: "",
    authProvider: "",
    status: "",
    limit: 100,
  });
  const [draftFilters, setDraftFilters] = useState({
    q: "",
    active: "",
    authProvider: "",
    status: "",
    limit: 100,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    active: true,
    status: "ACTIVE",
  });
  const tableSectionRef = useRef(null);

  const load = React.useCallback(
    async (nextFilters = filters, preferredId = "") => {
      setLoading(true);
      setMsg("");
      try {
        const data = await listSuperAssistants(nextFilters);
        const rows = coerceList(data);
        setItems(rows);
        setSummary({
          total: Number(data?.summary?.total || rows.length || 0),
          active: Number(data?.summary?.active || rows.filter((row) => row.active).length || 0),
          disabled: Number(data?.summary?.disabled || rows.filter((row) => !row.active).length || 0),
          activeToday: Number(
            data?.summary?.activeToday ||
              rows.filter((row) => row?.activityMetrics?.bucket === "ACTIVE_TODAY").length ||
              0
          ),
          active7d: Number(
            data?.summary?.active7d ||
              rows.filter((row) =>
                ["ACTIVE_TODAY", "ACTIVE_7D"].includes(row?.activityMetrics?.bucket)
              ).length ||
              0
          ),
          neverLoggedIn: Number(
            data?.summary?.neverLoggedIn ||
              rows.filter((row) => row?.activityMetrics?.bucket === "NEVER_LOGGED_IN").length ||
              0
          ),
          pendingResets: Number(
            data?.summary?.pendingResets || rows.filter((row) => row?.resetPasswordRequestedAt).length || 0
          ),
        });
        setSelectedRows((prev) => {
          const next = {};
          rows.forEach((row) => {
            if (prev[String(row._id)]) next[String(row._id)] = true;
          });
          return next;
        });
        setSelectedId((current) => {
          const keepCurrent = rows.some((row) => String(row._id) === String(current));
          const targetId = preferredId || (keepCurrent ? current : rows[0]?._id || "");
          return targetId ? String(targetId) : "";
        });
      } catch (err) {
        setItems([]);
        setSummary({
          total: 0,
          active: 0,
          disabled: 0,
          activeToday: 0,
          active7d: 0,
          neverLoggedIn: 0,
          pendingResets: 0,
        });
        setSelectedRows({});
        setSelectedId("");
        setMsg(err?.message || "Unable to load super assistants right now.");
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    if (!canManage) return;
    load(filters);
  }, [canManage, filters, load]);

  const selected = useMemo(
    () => items.find((row) => String(row._id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const selectedCount = useMemo(
    () => Object.values(selectedRows).filter(Boolean).length,
    [selectedRows]
  );

  useEffect(() => {
    if (!selected) {
      setEditForm({
        name: "",
        email: "",
        phone: "",
        active: true,
        status: "ACTIVE",
      });
      return;
    }
    setEditForm({
      name: selected.name || "",
      email: selected.email || "",
      phone: selected.phone || "",
      active: selected.active !== false,
      status: selected?.systemProfile?.status || "ACTIVE",
    });
  }, [selected]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      await updateSuperAssistant(selected._id, editForm);
      setMsg("Super assistant updated.");
      await load(filters, selected._id);
    } catch (err) {
      setMsg(err?.message || "Unable to save super assistant changes.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setSaving(true);
    setMsg("");
    try {
      await updateSuperAssistant(row._id, {
        active: row.active === false,
        status: row.active === false ? row?.systemProfile?.status || "ACTIVE" : "SUSPENDED",
      });
      setMsg(row.active === false ? "Super assistant re-enabled." : "Super assistant disabled.");
      await load(filters, row._id);
    } catch (err) {
      setMsg(err?.message || "Unable to update assistant access.");
    } finally {
      setSaving(false);
    }
  };

  const sendInviteOrReset = async (row) => {
    setSaving(true);
    setMsg("");
    try {
      const res = await sendSuperAssistantResetLink(row._id);
      if (res?.resetLink && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(res.resetLink).catch(() => {});
      }
      setMsg(
        res?.mode === "invite"
          ? "Invite link sent. The secure link was also copied if clipboard access was available."
          : "Reset link sent. The secure link was also copied if clipboard access was available."
      );
      await load(filters, row._id);
    } catch (err) {
      setMsg(err?.message || "Unable to send invite/reset link.");
    } finally {
      setSaving(false);
    }
  };

  const applyBulkAction = async () => {
    const ids = Object.entries(selectedRows)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
    if (!ids.length) {
      setMsg("Select at least one super assistant.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        ids,
        action: bulkAction,
        ...(bulkAction === "SET_STATUS" ? { status: bulkStatus } : {}),
      };
      const res = await bulkUpdateSuperAssistants(payload);
      setMsg(res?.msg || "Bulk action completed.");
      await load(filters, selectedId);
    } catch (err) {
      setMsg(err?.message || "Unable to run bulk action.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRowSelection = (id) => {
    setSelectedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allVisibleSelected = items.length > 0 && items.every((row) => selectedRows[String(row._id)]);

  const focusManagementTable = () => {
    tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applySummaryView = (kind) => {
    if (kind === "total") {
      const reset = { q: "", active: "", authProvider: "", status: "", limit: 100 };
      setDraftFilters(reset);
      setFilters(reset);
      focusManagementTable();
      return;
    }
    if (kind === "active") {
      const next = { ...draftFilters, active: "true" };
      setDraftFilters(next);
      setFilters(next);
      focusManagementTable();
      return;
    }
    if (kind === "disabled") {
      const next = { ...draftFilters, active: "false" };
      setDraftFilters(next);
      setFilters(next);
      focusManagementTable();
      return;
    }

    const matcher =
      kind === "activeToday"
        ? (row) => row?.activityMetrics?.bucket === "ACTIVE_TODAY"
        : kind === "active7d"
        ? (row) => ["ACTIVE_TODAY", "ACTIVE_7D"].includes(row?.activityMetrics?.bucket)
        : kind === "never"
        ? (row) => row?.activityMetrics?.bucket === "NEVER_LOGGED_IN"
        : (row) => Boolean(row?.resetPasswordRequestedAt);

    const match = items.find(matcher);
    if (match?._id) {
      setSelectedId(String(match._id));
      focusManagementTable();
      return;
    }
    setMsg("No assistants in this category for the current result set.");
    focusManagementTable();
  };

  if (!canManage) {
    return <p>🚫 Access denied</p>;
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Super Assistants</h2>
          <p className="muted">
            Manage human super assistants, bulk actions, invite/reset flows, and activity signals for the unified support layer.
          </p>
        </div>
        <div className="welcome-actions">
          <Link to="/admin/create-admin" className="btn-primary">
            Register Super Assistant
          </Link>
          <button type="button" className="btn-secondary" onClick={() => load(filters, selectedId)} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Total Assistants" value={summary.total} subtitle="Current filtered result set" onClick={() => applySummaryView("total")} />
          <StatCard title="Active Access" value={summary.active} subtitle="Accounts currently enabled" onClick={() => applySummaryView("active")} />
          <StatCard title="Disabled" value={summary.disabled} subtitle="Temporarily blocked accounts" onClick={() => applySummaryView("disabled")} />
          <StatCard title="Active Today" value={summary.activeToday} subtitle="Touched the workspace today" onClick={() => applySummaryView("activeToday")} />
          <StatCard title="Active 7 Days" value={summary.active7d} subtitle="Recent operating activity" onClick={() => applySummaryView("active7d")} />
          <StatCard title="Never Logged In" value={summary.neverLoggedIn} subtitle="Best candidates for invite links" onClick={() => applySummaryView("never")} />
          <StatCard title="Pending Reset Links" value={summary.pendingResets} subtitle="Password/reset requests already issued" onClick={() => applySummaryView("pendingResets")} />
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="ai-autofill-audit-filters">
            <label>
              Search
              <input
                value={draftFilters.q}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="name, email, phone"
              />
            </label>
            <label>
              Access
              <select
                value={draftFilters.active}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, active: e.target.value }))}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <label>
              Provider
              <select
                value={draftFilters.authProvider}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, authProvider: e.target.value }))}
              >
                <option value="">All</option>
                <option value="local">Password</option>
                <option value="google">Google</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={draftFilters.status}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="welcome-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={() => setFilters(draftFilters)} disabled={loading}>
              Apply Filters
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const reset = { q: "", active: "", authProvider: "", status: "", limit: 100 };
                setDraftFilters(reset);
                setFilters(reset);
              }}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Bulk Controls</h3>
              <p className="muted">Run safe access and invite actions on the selected assistants.</p>
            </div>
            <div className="action-pill">{selectedCount} selected</div>
          </div>
          <div className="ai-autofill-audit-filters" style={{ marginTop: 12 }}>
            <label>
              Action
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                {BULK_ACTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {bulkAction === "SET_STATUS" ? (
              <label>
                Status
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="welcome-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={applyBulkAction} disabled={saving || !selectedCount}>
              {saving ? "Working..." : "Apply to Selected"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (allVisibleSelected) {
                  setSelectedRows({});
                  return;
                }
                const next = {};
                items.forEach((row) => {
                  next[String(row._id)] = true;
                });
                setSelectedRows(next);
              }}
              disabled={!items.length}
            >
              {allVisibleSelected ? "Clear Selection" : "Select Visible"}
            </button>
          </div>
        </div>
      </section>

      <section
        className="section"
        ref={tableSectionRef}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}
      >
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Management Table</h3>
              <p className="muted">Select a row to review identity, access, and activity metrics.</p>
            </div>
            <div className="action-pill">{items.length} loaded</div>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => {
                        if (allVisibleSelected) {
                          setSelectedRows({});
                          return;
                        }
                        const next = {};
                        items.forEach((row) => {
                          next[String(row._id)] = true;
                        });
                        setSelectedRows(next);
                      }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Activity</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = String(row._id);
                  const isSelected = id === String(selectedId);
                  const needsInvite = row?.activityMetrics?.bucket === "NEVER_LOGGED_IN";
                  return (
                    <tr
                      key={row._id}
                      onClick={() => setSelectedId(id)}
                      style={isSelected ? { background: "rgba(37, 99, 235, 0.08)" } : undefined}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRows[id])}
                          onChange={() => toggleRowSelection(id)}
                        />
                      </td>
                      <td>
                        <strong>{row.name || "Unnamed"}</strong>
                        <div className="muted">{row.email || "No email"}</div>
                        {row.phone ? <div className="muted">{row.phone}</div> : null}
                      </td>
                      <td>
                        <div>{formatProvider(row.authProvider)}</div>
                        <div className="muted">{row.protectedAccount ? "Protected" : "Standard"}</div>
                      </td>
                      <td>
                        <StatusPill active={row.active !== false} status={row?.systemProfile?.status} />
                      </td>
                      <td>
                        <div className="assistant-badge-row-left">
                          <ActivityBadge bucket={row?.activityMetrics?.bucket} />
                        </div>
                        <div className="muted">
                          Devices: {row?.activityMetrics?.trustedDeviceCount ?? 0}
                        </div>
                      </td>
                      <td>{formatDateTime(row?.sessionSecurity?.lastLoginAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="welcome-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => toggleActive(row)}
                            disabled={saving}
                          >
                            {row.active === false ? "Enable" : "Disable"}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => sendInviteOrReset(row)}
                            disabled={saving || !row.email}
                          >
                            {needsInvite ? "Invite" : "Reset"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="muted">
                      No super assistants found for the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Assistant Access</h3>
              <p className="muted">Update the selected assistant without leaving this page.</p>
            </div>
          </div>
          {selected ? (
            <form className="form" onSubmit={onSave} style={{ marginTop: 12 }}>
              <label>
                Name
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+254..."
                />
              </label>
              <label>
                Operating Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ai-autofill-audit-check">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, active: e.target.checked }))}
                />
                <span>Account enabled</span>
              </label>

              <div className="profile-status-grid">
                <div className="profile-status-pill ok">
                  Auth: {formatProvider(selected.authProvider)}
                </div>
                <div className="profile-status-pill">
                  Last login: {formatDateTime(selected?.sessionSecurity?.lastLoginAt)}
                </div>
                <div className="profile-status-pill">
                  Last activity: {formatDateTime(selected?.systemProfile?.lastActivityAt)}
                </div>
                <div className="profile-status-pill warn">
                  Protected account: {selected.protectedAccount ? "Yes" : "No"}
                </div>
              </div>

              <div className="grid info-grid" style={{ marginTop: 12 }}>
                <div
                  className="card stat stat-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    applySummaryView(
                      selected?.activityMetrics?.bucket === "ACTIVE_TODAY"
                        ? "activeToday"
                        : selected?.activityMetrics?.bucket === "ACTIVE_7D"
                        ? "active7d"
                        : selected?.activityMetrics?.bucket === "NEVER_LOGGED_IN"
                        ? "never"
                        : "total"
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      applySummaryView(
                        selected?.activityMetrics?.bucket === "ACTIVE_TODAY"
                          ? "activeToday"
                          : selected?.activityMetrics?.bucket === "ACTIVE_7D"
                          ? "active7d"
                          : selected?.activityMetrics?.bucket === "NEVER_LOGGED_IN"
                          ? "never"
                          : "total"
                      );
                    }
                  }}
                >
                  <div className="card-title">Activity State</div>
                  <div className="card-value" style={{ fontSize: 18 }}>{formatBucket(selected?.activityMetrics?.bucket)}</div>
                </div>
                <div
                  className="card stat stat-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={focusManagementTable}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") focusManagementTable();
                  }}
                >
                  <div className="card-title">Trusted Devices</div>
                  <div className="card-value">{selected?.activityMetrics?.trustedDeviceCount ?? 0}</div>
                </div>
                <div
                  className="card stat stat-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={focusManagementTable}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") focusManagementTable();
                  }}
                >
                  <div className="card-title">Idle Days</div>
                  <div className="card-value">
                    {selected?.activityMetrics?.daysSinceLastLogin ?? "—"}
                  </div>
                </div>
                <div
                  className="card stat stat-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={focusManagementTable}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") focusManagementTable();
                  }}
                >
                  <div className="card-title">Account Age</div>
                  <div className="card-value">{selected?.activityMetrics?.accountAgeDays ?? 0}d</div>
                </div>
              </div>

              <div className="welcome-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => sendInviteOrReset(selected)}
                  disabled={saving || !selected.email}
                >
                  {selected?.activityMetrics?.bucket === "NEVER_LOGGED_IN" ? "Send Invite Link" : "Send Reset Link"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setEditForm({
                      name: selected.name || "",
                      email: selected.email || "",
                      phone: selected.phone || "",
                      active: selected.active !== false,
                      status: selected?.systemProfile?.status || "ACTIVE",
                    })
                  }
                  disabled={saving}
                >
                  Reset Form
                </button>
              </div>
            </form>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              Select a super assistant from the table to review or update access.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
