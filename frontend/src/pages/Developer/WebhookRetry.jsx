import React, { useEffect, useState } from "react";
import { listDlqItems, retryDlqItem } from "../../services/dlqApi";

export default function WebhookRetry() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listDlqItems();
      const filtered = (Array.isArray(data) ? data : []).filter(
        (i) => i?.data?.connectorId || i?.data?.payload
      );
      setItems(filtered);
    } catch {
      setItems([]);
      setMsg("Failed to load webhook retries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Webhook Retry</h2>
          <p className="muted">
            Retry failed webhook payloads from the integration DLQ.
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
                <th>Connector</th>
                <th>Reason</th>
                <th>Attempts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td>{i?.data?.connectorId || "-"}</td>
                  <td>{i.failedReason || "-"}</td>
                  <td>{i.attemptsMade || 0}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        await retryDlqItem(i.id);
                        load();
                      }}
                    >
                      Retry Webhook
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="5">No webhook retries queued</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
