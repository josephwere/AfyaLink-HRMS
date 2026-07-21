import { StatCard } from "../../components/Cards";
import useAIAutofillAudit from "../../hooks/useAIAutofillAudit";

const ACTION_OPTIONS = [
  { value: "AI_ASSISTANT_AUTOFILL_DRAFTED", label: "Drafted" },
  { value: "AI_ASSISTANT_AUTOFILL_APPLIED", label: "Applied" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatActor(row) {
  return row?.actor?.name || row?.actor?.email || row?.actor?.role || "System";
}

function formatHospital(row) {
  return row?.hospital?.name || row?.hospital?.code || row?.hospitalKey || "Global";
}

export default function AIAutofillAudit() {
  const {
    loading,
    msg,
    selectedId,
    setSelectedId,
    search,
    setSearch,
    filters,
    setFilters,
    visibleItems,
    stats,
    load,
    toggleAction,
    applySummaryActions,
    logSectionRef,
    selectedItem,
    defaultHospitalKey,
  } = useAIAutofillAudit();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>AI Autofill Audit</h2>
          <p className="muted">
            Review hospital-scoped AI draft/apply activity before staff commit autofill changes into live workflows.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => load(filters)} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard
            title="Draft Events"
            value={stats.drafted}
            onClick={() => applySummaryActions(["AI_ASSISTANT_AUTOFILL_DRAFTED"])}
          />
          <StatCard
            title="Apply Events"
            value={stats.applied}
            onClick={() => applySummaryActions(["AI_ASSISTANT_AUTOFILL_APPLIED"])}
          />
          <StatCard
            title="Hospitals"
            value={stats.hospitals}
            onClick={() => scrollToSection(logSectionRef)}
          />
          <StatCard
            title="Queued Fields"
            value={stats.queuedFields}
            onClick={() => applySummaryActions(["AI_ASSISTANT_AUTOFILL_DRAFTED"])}
          />
          <StatCard
            title="Applied Fields"
            value={stats.appliedFields}
            onClick={() => applySummaryActions(["AI_ASSISTANT_AUTOFILL_APPLIED"])}
          />
        </div>
      </section>

      <section className="section" ref={logSectionRef}>
        <div className="card">
          <div className="ai-autofill-audit-filters">
            <label>
              Hospital Key
              <input
                value={filters.hospitalKey}
                onChange={(e) => setFilters((prev) => ({ ...prev, hospitalKey: e.target.value }))}
                placeholder="Optional hospital key"
              />
            </label>
            <label>
              Limit
              <select
                value={filters.limit}
                onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}
              >
                {[25, 50, 100, 200].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="hospital, route, field, evidence"
              />
            </label>
          </div>

          <div className="ai-autofill-audit-actions">
            {ACTION_OPTIONS.map((option) => (
              <label key={option.value} className="ai-autofill-audit-check">
                <input
                  type="checkbox"
                  checked={filters.actions.includes(option.value)}
                  onChange={() => toggleAction(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
            <button type="button" className="btn-primary" onClick={() => load(filters)} disabled={loading}>
              Apply Filters
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const reset = {
                  actions: ACTION_OPTIONS.map((row) => row.value),
                  hospitalKey: defaultHospitalKey,
                  limit: 100,
                };
                setFilters(reset);
                setSearch("");
                load(reset);
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
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Hospital</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Template</th>
                  <th>Items</th>
                  <th>Sources</th>
                  <th>Summary</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((row) => {
                  const metadata = row.metadata || {};
                  const itemsCount = safeArray(metadata.items).length;
                  return (
                    <tr key={row.id}>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                      <td>
                        <strong>{formatHospital(row)}</strong>
                        <div className="muted">{row.hospitalKey || row.hospital?.id || "—"}</div>
                      </td>
                      <td>
                        {formatActor(row)}
                        <div className="muted">{row.actor?.role || "—"}</div>
                      </td>
                      <td>{row.action === "AI_ASSISTANT_AUTOFILL_APPLIED" ? "Applied" : "Drafted"}</td>
                      <td>
                        {row.metadata?.templateTitle || row.metadata?.templateId || "—"}
                        <div className="muted">{row.route || "—"}</div>
                      </td>
                      <td>{itemsCount}</td>
                      <td>{safeArray(metadata.sourceKinds).join(", ") || "—"}</td>
                      <td>{row.summary || "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={() => setSelectedId(row.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!visibleItems.length ? (
                  <tr>
                    <td colSpan={9}>No AI autofill audit events found for the current filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedItem ? (
        <div className="drawer-backdrop" onClick={() => setSelectedId("")} role="dialog" aria-modal="true">
          <div className="drawer-panel ai-autofill-audit-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>Autofill Event Detail</h3>
                <p className="muted">
                  {selectedItem.action === "AI_ASSISTANT_AUTOFILL_APPLIED" ? "Applied" : "Drafted"} · {formatHospital(selectedItem)}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setSelectedId("")}>
                Close
              </button>
            </div>

            <div className="ai-autofill-audit-summary">
              <div>
                <strong>Route</strong>
                <span>{selectedItem.route || "—"}</span>
              </div>
              <div>
                <strong>Actor</strong>
                <span>{formatActor(selectedItem)}</span>
              </div>
              <div>
                <strong>Source Kinds</strong>
                <span>{safeArray(selectedItem?.metadata?.sourceKinds).join(", ") || "—"}</span>
              </div>
              <div>
                <strong>Summary</strong>
                <span>{selectedItem.summary || "—"}</span>
              </div>
            </div>

            {safeArray(selectedItem?.metadata?.unmatched).length ? (
              <div className="card">
                <h4>Unmatched Items</h4>
                <ul>
                  {selectedItem.metadata.unmatched.map((row, index) => (
                    <li key={`${selectedItem.id}-unmatched-${index}`}>{row}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="card">
              <h4>Field Provenance</h4>
              <div className="table-wrap">
                <table className="table lite">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Value</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeArray(selectedItem?.metadata?.items).map((item, index) => (
                      <tr key={`${selectedItem.id}-item-${index}`}>
                        <td>{item?.fieldLabel || item?.fieldKey || "—"}</td>
                        <td>{String(item?.value ?? "—")}</td>
                        <td>{item?.confidence != null ? `${Math.round(Number(item.confidence) * 100)}%` : "—"}</td>
                        <td>{item?.status || "—"}</td>
                        <td>{item?.reason || "—"}</td>
                        <td>{item?.evidence || "—"}</td>
                      </tr>
                    ))}
                    {!safeArray(selectedItem?.metadata?.items).length ? (
                      <tr>
                        <td colSpan={6}>No field-level metadata recorded.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
