import React, { useEffect, useState } from "react";
import { listDlqItems, retryDlqItem, updateDlqItem } from "../../services/dlqApi";
import { listBackgroundJobs, retryBackgroundJob } from "../../services/backgroundJobsApi";

export default function QueueReplay() {
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
      setMsg("✅ Payload updated");
      setSelected(null);
      load();
    } catch (err) {
      setMsg("Invalid JSON payload");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Queue Replay</h2>
          <p className="muted">
            Inspect dead‑letter queue entries and replay them into the
            integration queue.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="card">
          <table className="table lite">
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
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td>{i.failedReason || "-"}</td>
                  <td>{i.attemptsMade || 0}</td>
                  <td>{i.timestamp ? new Date(i.timestamp).toLocaleString() : "-"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={async () => {
                        await retryDlqItem(i.id);
                        load();
                      }}
                    >
                      Replay
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => openEditor(i)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="5">No DLQ items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Durable Background Jobs</h3>
              <p className="muted">
                Mongo-backed retryable jobs for contact sync, outbound communications, and orchestration retries.
              </p>
            </div>
            <div className="action-pill">{backgroundJobs.length} recent jobs</div>
          </div>

          <table className="table lite" style={{ marginTop: 12 }}>
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
                  <td>{job.status}</td>
                  <td>{job.attemptsMade || 0}/{job.maxAttempts || 0}</td>
                  <td>{job.source || "-"}</td>
                  <td>{job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
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
                  <td colSpan="6">No background jobs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="section">
          <h3>Edit Payload</h3>
          <div className="card">
            <textarea
              rows={12}
              style={{ width: "100%" }}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
            <div className="action-list" style={{ marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => savePayload(false)}>
                Save
              </button>
              <button type="button" className="btn-primary" onClick={() => savePayload(true)}>
                Save & Replay
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
