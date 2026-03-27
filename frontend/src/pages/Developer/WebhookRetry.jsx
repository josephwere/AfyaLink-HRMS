import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { listDlqItems, retryDlqItem } from "../../services/dlqApi";

export default function WebhookRetry() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listDlqItems();
      const filtered = (Array.isArray(data) ? data : []).filter(
        (item) => item?.data?.connectorId || item?.data?.payload
      );
      setItems(filtered);
    } catch {
      setItems([]);
      setMsg("Failed to load webhook recovery queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const uniqueConnectors = new Set(items.map((item) => item?.data?.connectorId).filter(Boolean));
    const highAttempt = items.filter((item) => Number(item.attemptsMade || 0) >= 3).length;
    return {
      uniqueConnectors: uniqueConnectors.size,
      highAttempt,
      replayable: items.filter((item) => Number(item.attemptsMade || 0) < 10).length,
    };
  }, [items]);

  const connectorLeaders = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => {
      const key = item?.data?.connectorId || "unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([connector, count]) => ({ connector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  return (
    <div className="dashboard developer-console-page">
      <section className="welcome-panel premium-card developer-console-hero">
        <div className="developer-console-hero-copy">
          <div className="developer-console-kicker">Connector recovery</div>
          <h2>Webhook Recovery</h2>
          <p className="muted">Recover failed connector deliveries from a cleaner premium webhook operations view.</p>
          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Queue"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/queue-replay")}>Queue Replay</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/admin/realtime")}>Integration Monitor</button>
          </div>
        </div>
        <div className="developer-console-hero-meta">
          <div className={`developer-console-pulse ${items.length > 0 ? "warn" : "good"}`}>
            <span>Webhook backlog</span>
            <strong>{items.length}</strong>
            <small>Connector events waiting for reprocessing.</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>Connectors</span>
            <strong>{summary.uniqueConnectors}</strong>
            <small>Unique connector IDs represented in the queue.</small>
          </div>
          <div className={`developer-console-pulse ${summary.highAttempt > 0 ? "risk" : "good"}`}>
            <span>High-attempt replays</span>
            <strong>{summary.highAttempt}</strong>
            <small>Events already reprocessed three or more times.</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>Replayable now</span>
            <strong>{summary.replayable}</strong>
            <small>Items still within a safer manual replay range.</small>
          </div>
        </div>
      </section>

      {msg && <div className="premium-inline-note">{msg}</div>}

      <section className="section developer-console-grid">
        <div className="card premium-card developer-console-table-card">
          <div className="card-header-actions">
            <div>
              <h3>Webhook Queue</h3>
              <p className="muted">A cleaner list of failed webhook payloads, recovery posture, and connector context.</p>
            </div>
            <div className="developer-chip-row">
              <span className="developer-chip">Queued: {items.length}</span>
              <span className="developer-chip soft">Replayable: {summary.replayable}</span>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table lite developer-ops-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Connector</th>
                  <th>Reason</th>
                  <th>Attempts</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item?.data?.connectorId || "-"}</td>
                    <td>{item.failedReason || "-"}</td>
                    <td>{item.attemptsMade || 0}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={async () => {
                          await retryDlqItem(item.id);
                          load();
                        }}
                      >
                        Re-run Webhook
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <div className="developer-empty-state compact">
                        <strong>No webhook recoveries queued.</strong>
                        <p className="muted">Webhook failures will surface here when connectors need manual replay.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="developer-console-stack">
          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Connector concentration</h3>
                <p className="muted">See which connectors are generating the highest replay pressure.</p>
              </div>
            </div>
            <div className="developer-activity-list">
              {connectorLeaders.map((entry) => (
                <div key={entry.connector} className="developer-activity-item">
                    <div>
                      <strong>{entry.connector}</strong>
                      <p className="muted">Queued webhook replays</p>
                    </div>
                    <span className="developer-state-badge neutral">{entry.count}</span>
                  </div>
                ))}
              {!connectorLeaders.length && (
                <div className="developer-empty-state compact">
                  <strong>No connector hot spots.</strong>
                  <p className="muted">Connector pressure will show up here as soon as replays start stacking.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Webhook operator notes</h3>
                <p className="muted">Keep recovery work disciplined, especially when a connector is flapping.</p>
              </div>
            </div>
            <div className="developer-runbook-list">
              <div className="developer-runbook-item"><strong>Start with the connector</strong><p className="muted">Check whether failures cluster on one connector before replaying the entire queue.</p></div>
              <div className="developer-runbook-item"><strong>Verify downstream health</strong><p className="muted">A healthy payload can still fail if the receiving system is degraded or rate-limiting.</p></div>
              <div className="developer-runbook-item"><strong>Escalate repeated flaps</strong><p className="muted">High-attempt items usually mean the issue is structural, not a one-off replay miss.</p></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
