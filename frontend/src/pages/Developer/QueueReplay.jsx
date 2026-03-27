import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { listDlqItems, retryDlqItem, updateDlqItem } from "../../services/dlqApi";
import { listBackgroundJobs, retryBackgroundJob } from "../../services/backgroundJobsApi";

export default function QueueReplay() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [backgroundJobs, setBackgroundJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selected, setSelected] = useState(null);
  const [payload, setPayload] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [data, jobs] = await Promise.all([
        listDlqItems(),
        listBackgroundJobs({ limit: 30 }),
      ]);
      setItems(Array.isArray(data) ? data : []);
      setBackgroundJobs(Array.isArray(jobs?.items) ? jobs.items : []);
    } catch {
      setItems([]);
      setBackgroundJobs([]);
      setMsg("Failed to load DLQ items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEditor = (job) => {
    setSelected(job);
    setPayload(JSON.stringify(job.data || {}, null, 2));
  };

  const savePayload = async (replay = false) => {
    if (!selected) return;
    try {
      const parsed = JSON.parse(payload);
      await updateDlqItem(selected.id, parsed);
      if (replay) {
        await retryDlqItem(selected.id);
      }
      setMsg("Payload updated.");
      setSelected(null);
      load();
    } catch {
      setMsg("Invalid JSON payload");
    }
  };

  const summary = useMemo(() => {
    const failedJobs = backgroundJobs.filter((job) => ["FAILED", "DEAD_LETTER"].includes(job.status)).length;
    const replayReady = items.filter((item) => Number(item.attemptsMade || 0) < 10).length;
    const connectors = new Set(items.map((item) => item?.data?.connectorId).filter(Boolean)).size;
    return { failedJobs, replayReady, connectors };
  }, [backgroundJobs, items]);

  return (
    <div className="dashboard developer-console-page">
      <section className="welcome-panel premium-card developer-console-hero">
        <div className="developer-console-hero-copy">
          <div className="developer-console-kicker">Replay control</div>
          <h2>Queue Replay</h2>
          <p className="muted">Inspect dead letters, repair payloads safely, and requeue durable jobs from one operator-grade workspace.</p>
          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Replay Queue"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/webhook-retry")}>Open Webhook Recovery</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/developer/decision-cockpit")}>Open Decision Cockpit</button>
          </div>
        </div>
        <div className="developer-console-hero-meta">
          <div className={`developer-console-pulse ${items.length > 0 ? "risk" : "good"}`}>
            <span>DLQ backlog</span>
            <strong>{items.length}</strong>
            <small>Items currently waiting for operator review or replay.</small>
          </div>
          <div className={`developer-console-pulse ${summary.failedJobs > 0 ? "warn" : "good"}`}>
            <span>Durable job failures</span>
            <strong>{summary.failedJobs}</strong>
            <small>Mongo-backed jobs that need requeue or inspection.</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>Replay-ready</span>
            <strong>{summary.replayReady}</strong>
            <small>DLQ items still within safe replay limits.</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>Connectors affected</span>
            <strong>{summary.connectors}</strong>
            <small>Distinct connector paths represented in the current backlog.</small>
          </div>
        </div>
      </section>

      {msg && <div className="premium-inline-note">{msg}</div>}

      <section className="section developer-console-grid">
        <div className="card premium-card developer-console-table-card">
          <div className="card-header-actions">
            <div>
              <h3>Dead-letter Queue</h3>
              <p className="muted">Replay, edit, and route blocked integration payloads back into the live pipeline.</p>
            </div>
            <div className="developer-chip-row">
              <span className="developer-chip">Items: {items.length}</span>
              <span className="developer-chip soft">Replay-ready: {summary.replayReady}</span>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table lite developer-ops-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Reason</th>
                  <th>Attempts</th>
                  <th>Queued</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.failedReason || "-"}</td>
                    <td>{item.attemptsMade || 0}</td>
                    <td>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "-"}</td>
                    <td>
                      <div className="developer-inline-actions compact">
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={async () => {
                            await retryDlqItem(item.id);
                            load();
                          }}
                        >
                          Replay
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={() => openEditor(item)}
                        >
                          Edit Payload
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <div className="developer-empty-state compact">
                        <strong>No DLQ items.</strong>
                        <p className="muted">Dead-letter payloads will appear here when the pipeline needs operator intervention.</p>
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
                <h3>Replay Discipline</h3>
                <p className="muted">Guardrails that keep replays safe, auditable, and low-risk.</p>
              </div>
            </div>
            <div className="developer-runbook-list">
              <div className="developer-runbook-item"><strong>Repair before replay</strong><p className="muted">Fix payload shape or connector metadata first so the queue does not immediately loop back into failure.</p></div>
              <div className="developer-runbook-item"><strong>Replay the smallest blast radius</strong><p className="muted">Start with one payload, confirm the fix, then widen requeue activity if the connector stabilizes.</p></div>
              <div className="developer-runbook-item"><strong>Trace the cause</strong><p className="muted">Use audit logs and webhook recovery history to distinguish bad payloads from unstable downstream systems.</p></div>
            </div>
            <div className="developer-inline-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate("/admin/audit-logs")}>Audit Logs</button>
              <button type="button" className="btn-secondary" onClick={() => navigate("/admin/realtime")}>Integration Monitor</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card developer-console-table-card">
          <div className="card-header-actions">
            <div>
              <h3>Durable Background Jobs</h3>
              <p className="muted">Recoverable jobs for contact sync, outbound communications, and orchestration.</p>
            </div>
            <div className="action-pill">{backgroundJobs.length} recent jobs</div>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table lite developer-ops-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Source</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {backgroundJobs.map((job) => (
                  <tr key={job._id}>
                    <td>{job.type}</td>
                    <td><span className={`developer-state-badge ${["FAILED", "DEAD_LETTER"].includes(job.status) ? "risk" : job.status === "COMPLETED" ? "good" : "warn"}`}>{job.status}</span></td>
                    <td>{job.attemptsMade || 0}/{job.maxAttempts || 0}</td>
                    <td>{job.source || "-"}</td>
                    <td>{job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={async () => {
                          await retryBackgroundJob(job._id);
                          load();
                        }}
                        disabled={job.status !== "DEAD_LETTER" && job.status !== "FAILED"}
                      >
                        Requeue
                      </button>
                    </td>
                  </tr>
                ))}
                {backgroundJobs.length === 0 && (
                  <tr>
                    <td colSpan="6">
                        <div className="developer-empty-state compact">
                          <strong>No background jobs found.</strong>
                          <p className="muted">When durable recovery is active, their state will appear here.</p>
                        </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selected && (
        <section className="section">
          <div className="card premium-card developer-editor-card">
            <div className="card-header-actions">
              <div>
                <h3>Edit Payload</h3>
                <p className="muted">Patch the dead-letter payload carefully, then save or save and replay.</p>
              </div>
              <div className="developer-chip">DLQ item: {selected.id}</div>
            </div>
            <textarea
              rows={14}
              className="developer-json-input"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
            <div className="developer-inline-actions">
              <button type="button" className="btn-secondary" onClick={() => savePayload(false)}>
                Save Payload
              </button>
              <button type="button" className="btn-primary" onClick={() => savePayload(true)}>
                Save and Replay
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
