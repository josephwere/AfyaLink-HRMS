import React from "react";
import useClaimRules from "../../hooks/useClaimRules";

export default function ClaimRules() {
  const {
    items,
    msg,
    loading,
    filters,
    form,
    setFilters,
    setForm,
    createRule,
    toggleRule,
    load,
    ruleTypes,
  } = useClaimRules();

  const submit = async (e) => {
    e.preventDefault();
    await createRule();
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Claim Rules</h2>
          <p className="muted">Country-specific procedure limits and fraud rules that enforce safe claims globally.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <h3>Add Rule</h3>
        <form className="card form" onSubmit={submit}>
          <input placeholder="Country (blank = global)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
          <select value={form.ruleType} onChange={(e) => setForm({ ...form, ruleType: e.target.value })}>
            {ruleTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input placeholder="Procedure code" value={form.procedureCode} onChange={(e) => setForm({ ...form, procedureCode: e.target.value.toUpperCase() })} />
          <input placeholder="Procedure category" value={form.procedureCategory} onChange={(e) => setForm({ ...form, procedureCategory: e.target.value.toUpperCase() })} />
          <input placeholder="Max per window" value={form.maxPerWindow} onChange={(e) => setForm({ ...form, maxPerWindow: e.target.value })} />
          <input placeholder="Window days" value={form.windowDays} onChange={(e) => setForm({ ...form, windowDays: e.target.value })} />
          <input placeholder="Min age" value={form.minAge} onChange={(e) => setForm({ ...form, minAge: e.target.value })} />
          <input placeholder="Max age" value={form.maxAge} onChange={(e) => setForm({ ...form, maxAge: e.target.value })} />
          <input placeholder="Allowed genders (comma-separated)" value={form.allowedGenders} onChange={(e) => setForm({ ...form, allowedGenders: e.target.value })} />
          <input placeholder="Cooldown days" value={form.cooldownDays} onChange={(e) => setForm({ ...form, cooldownDays: e.target.value })} />
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Rule"}</button>
        </form>
      </section>

      <section className="section">
        <h3>Rules</h3>
        <div className="card">
          <div className="search-wrap" style={{ marginBottom: 12, display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <input className="search-input" placeholder="Country" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value.toUpperCase() })} />
            <select value={filters.ruleType} onChange={(e) => setFilters({ ...filters, ruleType: e.target.value })}>
              <option value="">All rule types</option>
              {ruleTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={filters.enabled} onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}>
              <option value="">All statuses</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Country</th>
                <th>Rule</th>
                <th>Procedure</th>
                <th>Limits</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((rule) => (
                <tr key={rule._id}>
                  <td>{rule.country || "GLOBAL"}</td>
                  <td>{rule.ruleType}</td>
                  <td>{rule.procedureCode || rule.procedureCategory || "-"}</td>
                  <td>
                    {rule.ruleType === "MAX_PER_WINDOW" ? `${rule.maxPerWindow || "-"} / ${rule.windowDays || "-"}d` : null}
                    {rule.ruleType === "AGE_LIMIT" ? `${rule.minAge ?? "-"} - ${rule.maxAge ?? "-"}` : null}
                    {rule.ruleType === "GENDER_ONLY" ? (rule.allowedGenders || []).join(", ") : null}
                    {rule.ruleType === "COOLDOWN_DAYS" ? `${rule.cooldownDays || "-"}d` : null}
                  </td>
                  <td>{rule.severity}</td>
                  <td>
                    <button
                      type="button"
                      className={rule.enabled ? "btn-secondary" : "btn-primary"}
                      onClick={() => toggleRule(rule)}
                      disabled={loading}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No claim rules found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
