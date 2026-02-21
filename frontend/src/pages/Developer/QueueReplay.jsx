import React, { useEffect, useState } from "react";
import { listDlqItems, retryDlqItem, updateDlqItem } from "../../services/dlqApi";

export default function QueueReplay() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selected, setSelected] = useState(null);
  const [payload, setPayload] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listDlqItems();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
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
          <button className="btn-secondary" onClick={load} disabled={loading}>
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
                      className="btn-secondary"
                      onClick={async () => {
                        await retryDlqItem(i.id);
                        load();
                      }}
                    >
                      Replay
                    </button>
                    <button
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
              <button className="btn-secondary" onClick={() => savePayload(false)}>
                Save
              </button>
              <button className="btn-primary" onClick={() => savePayload(true)}>
                Save & Replay
              </button>
              <button className="btn-secondary" onClick={() => setSelected(null)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
