import { usePilotOnboardingOps } from "../../hooks/usePilotOnboardingOps";

export default function PilotOnboardingOps() {
  const { items, loading, busy, message, hospital, setHospital, load, createChecklist, toggleItem } = usePilotOnboardingOps();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Pilot Onboarding Ops</h2>
          <p className="muted">Track per-hospital go-live readiness and completion evidence.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {message ? (
        <section className="section"><div className="card"><p className="muted">{message}</p></div></section>
      ) : null}

      <section className="section">
        <div className="card">
          <h3>Checklist Scope</h3>
          <div className="form-row">
            <input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Hospital ID" />
            <button type="button" className="btn primary" onClick={createChecklist} disabled={busy === "create"}>
              {busy === "create" ? "Saving..." : "Create/Update Checklist"}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Checklists</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Phase</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry._id}>
                    <td>{entry.hospital || "—"}</td>
                    <td>{entry.status}</td>
                    <td>{entry.phase}</td>
                    <td>
                      <div className="form-grid">
                        {(entry.items || []).map((item) => (
                          <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.completed)}
                              onChange={() => toggleItem(entry, item.key, item.completed)}
                              disabled={busy === `${entry._id}:${item.key}`}
                            />
                            <span>{item.title}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={4} className="muted">No checklists found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
