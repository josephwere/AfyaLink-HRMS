import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { ROLES } from '../../constants/roles';

const ROLE_OPTIONS = [
  ROLES.SUPER_ADMIN,
  ROLES.SYSTEM_ADMIN,
  ROLES.SUPER_ASSISTANT,
  ROLES.HOSPITAL_ADMIN,
  ROLES.DOCTOR,
  ROLES.NURSE,
  ROLES.LAB_TECH,
  ROLES.PATIENT,
];

export default function RBAC(){
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [role, setRole] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    loadUsers();
  }, []);
  const loadUsers = async () => {
    try {
      const data = await apiFetch('/api/users');
      setUsers(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setUsers([]);
    }
  };
  const changeRole = async ()=> {
    if(!selected || !role) return;
    await apiFetch('/api/users/'+selected._id, { method: 'PATCH', body: { role } });
    setMsg(`Updated ${selected.name || selected.email} to ${role}.`);
    await loadUsers();
    setSelected(null);
  };
  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Access control</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Role Management</h1>
            <p className="premium-shell-subtitle">
              Review user roles and promote, reduce, or reroute privileges without dropping into prompt-based tooling.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Users</span>
              <strong>{users.length}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Selection</span>
              <strong>{selected ? "Active" : "None"}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="premium-split">
        <section className="card premium-card premium-stack">
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr>
              </thead>
              <tbody>
                {users.map(u=> (
                  <tr key={u._id}>
                    <td>{u.name || "—"}</td>
                    <td>{u.email || "—"}</td>
                    <td>{u.role || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setSelected(u);
                          setRole(u.role || "");
                          setMsg("");
                        }}
                      >
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card premium-card premium-stack">
          <div className="premium-tag">Role editor</div>
          {selected ? (
            <>
              <div className="premium-note">
                <strong>Selected user</strong>
                <span>{selected.name || selected.email}</span>
              </div>
              <label>New role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Select a role</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="welcome-actions">
                <button type="button" className="btn-primary" onClick={changeRole}>Save role</button>
                <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Clear</button>
              </div>
            </>
          ) : (
            <div className="premium-empty">
              <strong>No user selected</strong>
              <span>Pick a user from the table to update their role safely from this side panel.</span>
            </div>
          )}
          {msg ? <div className="premium-inline-note">{msg}</div> : null}
        </aside>
      </div>
    </div>
  );
}
