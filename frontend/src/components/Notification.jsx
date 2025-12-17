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
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(12px);
          padding: 14px 20px;
          border-radius: 12px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
          border-left: 6px solid #3b82f6;
          animation: slideIn 0.4s ease-out;
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

        @keyframes slideIn {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
            }
