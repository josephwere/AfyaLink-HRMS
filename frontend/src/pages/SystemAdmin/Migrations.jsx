import { useSystemAdminMigrations } from "../../hooks/useSystemAdminMigrations";

export default function SystemMigrations() {
  const { items, loading, msg, form, setForm, createProject, startDryRun } = useSystemAdminMigrations();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Migration Hub</h2>
          <p className="muted">
            Connect existing hospital systems to AfyaLink with phased migration and zero disruption.
          </p>
        </div>
      </div>

      <section className="section">
        <form className="card premium-card" onSubmit={createProject}>
          <h3>Create Migration Project</h3>
          <div className="grid-3" style={{ gap: 10 }}>
            <input
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              placeholder="Source system name"
              value={form.sourceName}
              onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))}
            />
            <input
              placeholder="Vendor"
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="OTHER">Other</option>
              <option value="HIS">HIS</option>
              <option value="EMR">EMR</option>
              <option value="LIS">LIS</option>
              <option value="PACS">PACS</option>
              <option value="PAYROLL">Payroll</option>
            </select>
            <select
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
            >
              <option value="HYBRID">Hybrid</option>
              <option value="AI_ASSISTED">AI Assisted</option>
              <option value="MANUAL">Manual</option>
            </select>
            <input
              placeholder="AI engine"
              value={form.aiEngine}
              onChange={(e) => setForm((f) => ({ ...f, aiEngine: e.target.value }))}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn-primary" type="submit">
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Projects</h3>
          {loading ? (
            <p className="muted">Loading migration projects...</p>
          ) : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Hospital</th>
                    <th>Status</th>
                    <th>Strategy</th>
                    <th>Progress</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it._id}>
                      <td>
                        <strong>{it.name}</strong>
                        <div className="muted">
                          {it.sourceSystem?.name || "Source system not set"} •{" "}
                          {it.sourceSystem?.vendor || "Unknown vendor"}
                        </div>
                      </td>
                      <td>{it.hospital?.name || "—"}</td>
                      <td>{it.status}</td>
                      <td>{it.strategy?.mode || "HYBRID"}</td>
                      <td>
                        {it.progress?.recordsMigrated || 0}/{it.progress?.recordsScanned || 0}
                      </td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => startDryRun(it._id)}>
                          Start Dry Run
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        No migration projects yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {msg ? <p className="muted">{msg}</p> : null}
        </div>
      </section>
    </div>
  );
}
