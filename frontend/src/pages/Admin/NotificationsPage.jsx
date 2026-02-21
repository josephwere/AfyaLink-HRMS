import React, { useEffect, useState } from "react";
import {
  listNotificationsFiltered,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../../services/notificationsApi";

export default function Page() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [read, setRead] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    const readParam =
      read === "ALL" ? undefined : read === "READ" ? "true" : "false";
    listNotificationsFiltered({ category, read: readParam })
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else if (Array.isArray(data?.items)) setItems(data.items);
        else setItems([]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [category, read]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Notifications</h2>
          <p className="muted">Recent workflow and system updates.</p>
        </div>
        <div className="welcome-actions">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ALL">All Categories</option>
            <option value="WORKFORCE">Workforce</option>
            <option value="SECURITY">Security</option>
            <option value="BILLING">Billing</option>
            <option value="SYSTEM">System</option>
            <option value="INTEGRATION">Integration</option>
            <option value="AI">AI</option>
          </select>
          <select value={read} onChange={(e) => setRead(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
          <button
            className="btn-secondary"
            onClick={async () => {
              await markAllNotificationsRead();
              setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            }}
          >
            Mark all read
          </button>
        </div>
      </div>

      <section className="section">
        <div className="card">
          {loading && <p>Loading...</p>}
          {!loading && (
            <table className="table lite">
            <thead>
              <tr>
                <th>Time</th>
                <th>Title</th>
                <th>Category</th>
                <th>Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n._id}>
                  <td>{new Date(n.createdAt).toLocaleString()}</td>
                  <td>
                    {n.title || "Notification"}
                    {!n.read && <span className="badge-dot" style={{ marginLeft: 8 }}>!</span>}
                  </td>
                  <td>{n.category || "SYSTEM"}</td>
                  <td>{n.body || "-"}</td>
                  <td>
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          if (n.read) {
                            await markNotificationUnread(n._id);
                            setItems((prev) =>
                              prev.map((item) =>
                                item._id === n._id ? { ...item, read: false } : item
                              )
                            );
                          } else {
                            await markNotificationRead(n._id);
                            setItems((prev) =>
                              prev.map((item) =>
                                item._id === n._id ? { ...item, read: true } : item
                              )
                            );
                          }
                        }}
                      >
                        {n.read ? "Mark unread" : "Mark read"}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5">No notifications yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
