import React, { useEffect, useState } from "react";

export default function Notifications({ notifications = [] }) {
  const [visibleNotifications, setVisibleNotifications] = useState([]);

  useEffect(() => {
    if (notifications.length === 0) return;

    const newNotifications = notifications.slice(-5).map((n) => ({
      ...n,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));

    setVisibleNotifications(newNotifications);

    // Auto-remove notification after 5 seconds
    const timer = setTimeout(() => {
      setVisibleNotifications((prev) => prev.slice(1));
    }, 5000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const getColor = (type) => {
    switch (type) {
      case "success":
        return "#10b981"; // green
      case "error":
        return "#ef4444"; // red
      case "warning":
        return "#f59e0b"; // yellow
      default:
        return "#3b82f6"; // info / blue
    }
  };

  return (
    <div className="notification-container">
      {visibleNotifications.map((n) => (
        <div
          key={n.id}
          className="notification-card"
          style={{ borderLeftColor: getColor(n.type) }}
          role="alert"
          aria-label={`${n.type} notification: ${n.message}`}
        >
          <p>{n.message}</p>
          <span className="timestamp">{n.timestamp}</span>
        </div>
      ))}

      <style>{`
        .notification-container {
          position: fixed;
          top: 80px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 9999;
        }

        .notification-card {
          background: #ffffff;
          padding: 14px 20px;
          border-radius: 8px;
          box-shadow: none;
          border: 1px solid #d4d4d8;
          border-left: 6px solid #3b82f6;
          font-size: 14px;
          position: relative;
          min-width: 260px;
        }

        .notification-card p {
          margin: 0;
          font-weight: 500;
        }

        .timestamp {
          position: absolute;
          top: 8px;
          right: 12px;
          font-size: 11px;
          color: #555;
        }
      `}</style>
    </div>
  );
}
