import React, { useEffect, useState } from "react";
import { useSocket } from "../utils/socket";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationsApi";

export default function Notifications(){
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("ALL");
  const [read, setRead] = useState("ALL");
  const socket = useSocket();
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "ALL") params.set("category", category);
    if (read === "READ") params.set("read", "true");
    if (read === "UNREAD") params.set("read", "false");
    const query = params.toString();
    const fetcher = query
      ? listNotifications({ query })
      : listNotifications();
    fetcher
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else if (Array.isArray(data?.items)) setItems(data.items);
        else setItems([]);
      })
      .catch(() => {});
  }, [category, read]);
  useEffect(()=>{
    if (!socket) return;
    socket.on('invoiceCreated', (data)=> setItems(i=>[...i,{title:'Invoice', body:'New invoice created', meta:data, read:false}]));
    socket.on('paymentRecorded', (data)=> setItems(i=>[...i,{title:'Payment', body:'Payment recorded', meta:data, read:false}]));
    socket.on('labResult', (data)=> setItems(i=>[...i,{title:'Lab', body:'Lab result available', meta:data, read:false}]));
    return ()=>{ socket.off('invoiceCreated'); socket.off('paymentRecorded'); socket.off('labResult'); }
  },[socket]);
  return (
    <div className="card">
      <div className="welcome-panel" style={{ marginBottom: 12 }}>
        <div>
          <h4>Notifications</h4>
          <p className="muted">Recent activity and requests.</p>
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
      <ul>
        {items.map((n,idx)=> (
          <li key={idx}>
            <button
              className="action-link"
              style={{ background: n.read ? "#6b7280" : "#111827" }}
              onClick={async () => {
                if (n._id && !n.read) {
                  await markNotificationRead(n._id);
                }
                setItems((prev) =>
                  prev.map((item) =>
                    item._id === n._id ? { ...item, read: true } : item
                  )
                );
              }}
            >
              <strong>{n.title}</strong> - {n.body || (n.meta && n.meta.test)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
