import React from "react";
import { useAIExtractionHistory } from "../../hooks/useAIExtractionHistory";

export default function AIExtractionHistory() {
  const {
    ACTION_OPTIONS,
    items,
    loading,
    msg,
    filters,
    setFilters,
    search,
    setSearch,
    load,
    visibleItems,
  } = useAIExtractionHistory();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>AI Extraction History</h2>
          <p className="muted">Audit trail of NeuroEdge document extraction operations.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="grid info-grid">
            <label>
              Action
              <select
                value={filters.action}
                onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hospital Id
              <input
                value={filters.hospital}
                onChange={(e) => setFilters((p) => ({ ...p, hospital: e.target.value }))}
                placeholder="Optional hospital id"
              />
            </label>
            <label>
              Limit
              <select
                value={filters.limit}
                onChange={(e) => setFilters((p) => ({ ...p, limit: Number(e.target.value) }))}
              >
                {[25, 50, 100, 200].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="actor, file, provider, mime"
              />
            </label>
          </div>
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={() => load(filters)} disabled={loading}>
              Apply Filters
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const reset = { action: "AI_DOCUMENT_EXTRACTED", hospital: "", limit: 100 };
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
        <div className="card">
          <table className="table lite">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Filename</th>
                <th>MimeType</th>
                <th>Size</th>
                <th>Provider</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                  <td>{row.actor?.name || row.actor?.email || "-"}</td>
                  <td>{row.actor?.role || "-"}</td>
                  <td>{row.metadata?.filename || "-"}</td>
                  <td>{row.metadata?.mimeType || "-"}</td>
                  <td>{row.metadata?.size || "-"}</td>
                  <td>{row.metadata?.provider || "-"}</td>
                  <td>{row.success ? "Success" : row.error || "Failed"}</td>
                </tr>
              ))}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan="8">No extraction logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
