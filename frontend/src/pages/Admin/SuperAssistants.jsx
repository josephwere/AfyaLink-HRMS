import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { listSuperAssistants, updateSuperAssistant } from "../../services/superAdminApi";
import { useAuth } from "../../utils/auth";

const STATUS_OPTIONS = ["ACTIVE", "SUSPENDED", "ON_LEAVE"];

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

function StatusPill({ active, status }) {
  const normalized = String(status || "ACTIVE").toUpperCase();
  const tone = !active || normalized === "SUSPENDED" ? "warn" : "ok";
  const label = !active ? "DISABLED" : normalized.replaceAll("_", " ");
  return <span className={`profile-status-pill ${tone}`}>{label}</span>;
}

export default function SuperAssistants() {
  const { user } = useAuth();
  const actorRole = String(user?.role || "").toUpperCase();
  const canManage = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedId, setSelectedId] = useState("");
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

  const load = React.useCallback(async (nextFilters = filters, preferredId = "") => {
    setLoading(true);
    setMsg("");
    try {
      const data = await listSuperAssistants(nextFilters);
      const rows = coerceList(data);
      setItems(rows);
      setSelectedId((current) => {
        const keepCurrent = rows.some((row) => String(row._id) === String(current));
        const targetId = preferredId || (keepCurrent ? current : rows[0]?._id || "");
        return targetId ? String(targetId) : "";
      });
    } catch (err) {
      setItems([]);
      setSelectedId("");
      setMsg(err?.message || "Unable to load super assistants right now.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!canManage) return;
    load(filters);
  }, [canManage, filters, load]);

  const selected = useMemo(
    () => items.find((row) => String(row._id) === String(selectedId)) || null,
    [items, selectedId]
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

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((row) => row.active !== false).length;
    const suspended = items.filter(
      (row) => String(row?.systemProfile?.status || "ACTIVE").toUpperCase() === "SUSPENDED"
    ).length;
    const google = items.filter((row) => String(row.authProvider || "local").toLowerCase() === "google").length;
    const recent = items.filter((row) => row?.sessionSecurity?.lastLoginAt).length;
    return { total, active, suspended, google, recent };
  }, [items]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      const data = await updateSuperAssistant(selected._id, editForm);
      const updated = data?.user || data?.assistant || null;
      setItems((prev) =>
        prev.map((row) => (String(row._id) === String(selected._id) ? { ...row, ...updated } : row))
      );
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

  if (!canManage) {
    return <p>🚫 Access denied</p>;
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Super Assistants</h2>
          <p className="muted">
            Manage human super assistants, access posture, and current operating status for the unified support layer.
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
          <StatCard title="Total Assistants" value={stats.total} subtitle="Current filtered result set" />
          <StatCard title="Active Access" value={stats.active} subtitle="Accounts currently enabled" />
          <StatCard title="Suspended" value={stats.suspended} subtitle="Need review before reactivation" />
          <StatCard title="Google Sign-In" value={stats.google} subtitle="Accounts linked to Google auth" />
          <StatCard title="Seen Recently" value={stats.recent} subtitle="Have a recorded last login" />
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
            <button
              type="button"
              className="btn-primary"
              onClick={() => setFilters(draftFilters)}
              disabled={loading}
            >
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

      <section
        className="section"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}
      >
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Management Table</h3>
              <p className="muted">Select a row to review identity, access, and current status.</p>
            </div>
            <div className="action-pill">{items.length} loaded</div>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const isSelected = String(row._id) === String(selectedId);
                  return (
                    <tr
                      key={row._id}
                      onClick={() => setSelectedId(String(row._id))}
                      style={isSelected ? { background: "rgba(37, 99, 235, 0.08)" } : undefined}
                    >
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
                      <td>{formatDateTime(row?.sessionSecurity?.lastLoginAt)}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActive(row);
                          }}
                          disabled={saving}
                        >
                          {row.active === false ? "Enable" : "Disable"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="muted">
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
                  Created: {formatDateTime(selected.createdAt)}
                </div>
                <div className="profile-status-pill warn">
                  Protected account: {selected.protectedAccount ? "Yes" : "No"}
                </div>
              </div>

              <div className="welcome-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
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
