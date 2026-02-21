import React, { useEffect, useState } from "react";
import { listAiAdminLogs } from "../../services/aiAdminApi";

const ACTION_OPTIONS = [
  "AI_DOCUMENT_EXTRACTED",
  "AI_DOCUMENT_EXTRACTION_FAILED",
  "AI_DIGITAL_TWIN_RUN",
];

export default function AIExtractionHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filters, setFilters] = useState({
    action: "AI_DOCUMENT_EXTRACTED",
    hospital: "",
    limit: 100,
  });
  const [search, setSearch] = useState("");

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setMsg("");
    try {
      const data = await listAiAdminLogs(nextFilters);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load extraction history");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = items.filter((row) => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return true;
    const actor = `${row.actor?.name || ""} ${row.actor?.email || ""}`.toLowerCase();
    const filename = String(row.metadata?.filename || "").toLowerCase();
    const mimeType = String(row.metadata?.mimeType || "").toLowerCase();
    const provider = String(row.metadata?.provider || "").toLowerCase();
    return actor.includes(q) || filename.includes(q) || mimeType.includes(q) || provider.includes(q);
  });

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>AI Extraction History</h2>
          <p className="muted">Audit trail of NeuroEdge document extraction operations.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>
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
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={() => load(filters)} disabled={loading}>
              Apply Filters
            </button>
            <button
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
