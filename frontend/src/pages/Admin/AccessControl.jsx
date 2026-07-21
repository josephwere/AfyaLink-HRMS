import { useNavigate } from "react-router-dom";
import { useAccessControl } from "../../hooks/useAccessControl";

export default function AccessControl() {
  const navigate = useNavigate();
  const {
    permissionsRef,
    q,
    setQ,
    scope,
    selectedUserId,
    setSelectedUserId,
    checked,
    setChecked,
    busy,
    loading,
    message,
    catalogBySection,
    loadScope,
    onSave,
  } = useAccessControl();

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
            <div
              className="kpi-card kpi-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/profile")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate("/profile");
                }
              }}
            >
              <div className="kpi-label">Your Role</div>
              <div className="kpi-value">{scope.actorRole}</div>
            </div>
            <div
              className="kpi-card kpi-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => permissionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  permissionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              <div className="kpi-label">Manageable Roles</div>
              <div className="kpi-value">{(scope.manageableRoles || []).length}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card" ref={permissionsRef}>
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
