import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getDelegationScope,
  getUserDelegatedPermissions,
  saveUserDelegatedPermissions,
} from "../../services/delegatedPermissionsApi";

export default function AccessControl() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [scope, setScope] = useState({
    actorRole: "",
    manageableRoles: [],
    users: [],
    permissionsCatalog: [],
  });
  const [selectedUserId, setSelectedUserId] = useState(() => searchParams.get("userId") || "");
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadScope = async () => {
    setLoading(true);
    try {
      const data = await getDelegationScope({ q });
      setScope(data || {});
      if (!selectedUserId && data?.users?.length) {
        setSelectedUserId(String(data.users[0]._id));
      }
    } catch (err) {
      setMessage(err?.message || "Failed to load access scope");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScope();
  }, []);

  useEffect(() => {
    const id = setTimeout(loadScope, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!selectedUserId) return;
    setBusy(true);
    getUserDelegatedPermissions(selectedUserId)
      .then((data) => {
        const targetRole = String(data?.target?.role || "").toUpperCase();
        const next = {};
        for (const item of scope.permissionsCatalog || []) {
          const roles = Array.isArray(item.roles) ? item.roles : [];
          next[item.permissionKey] = roles.includes(targetRole);
        }
        for (const grant of data?.grants || []) {
          const key = grant?.permissionKey;
          if (!key) continue;
          next[key] = grant?.effect === "ALLOW";
        }
        setChecked(next);
      })
      .catch(() => setChecked({}))
      .finally(() => setBusy(false));
  }, [selectedUserId, scope.permissionsCatalog]);

  const catalogBySection = useMemo(() => {
    const map = new Map();
    for (const item of scope.permissionsCatalog || []) {
      const section = item.section || "General";
      const arr = map.get(section) || [];
      arr.push(item);
      map.set(section, arr);
    }
    return Array.from(map.entries());
  }, [scope.permissionsCatalog]);

  const onSave = async () => {
    if (!selectedUserId) return;
    setBusy(true);
    setMessage("");
    try {
      const grants = Object.entries(checked).map(([permissionKey, allowed]) => ({
        permissionKey,
        action: "VIEW",
        effect: allowed ? "ALLOW" : "DENY",
      }));
      await saveUserDelegatedPermissions(selectedUserId, grants);
      setMessage("Access permissions updated successfully.");
    } catch (err) {
      setMessage(err?.message || "Failed to save permissions");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Delegated Access Control</h2>
        <p className="muted">
          Hierarchy enforced automatically: Founder/Super Admin {">"} System Admin/Hospital Admin,
          System Admin {">"} Hospital Admin, Hospital Admin {">"} hospital workers.
        </p>
        {scope.actorRole ? (
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Your Role</div>
              <div className="kpi-value">{scope.actorRole}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Manageable Roles</div>
              <div className="kpi-value">{(scope.manageableRoles || []).length}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="form-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by name/email"
          />
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Select user</option>
            {(scope.users || []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={loadScope} disabled={loading}>
            Refresh
          </button>
        </div>

        {catalogBySection.map(([section, rows]) => (
          <div key={section} className="section-block">
            <h3>{section}</h3>
            <div className="form-grid">
              {rows.map((row) => (
                <label key={row.permissionKey} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[row.permissionKey])}
                    onChange={(e) =>
                      setChecked((prev) => ({
                        ...prev,
                        [row.permissionKey]: e.target.checked,
                      }))
                    }
                    disabled={busy || !selectedUserId}
                  />
                  <span>{row.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="form-actions">
          <button type="button" className="btn primary" onClick={onSave} disabled={!selectedUserId || busy}>
            Save Access Rules
          </button>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </div>
    </div>
  );
}
