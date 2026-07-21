import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "../../contexts/NavigationContext";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import "./NotificationsBadge.css";

/**
 * Notification Item Component
 */
function NotificationItem({ notification, onDismiss }) {
  const { translateText } = useAppLanguage();

  const handleDismiss = (e) => {
    e.preventDefault();
    onDismiss(notification.id);
  };

  return (
    <li className={`notification-item notification-${notification.type}`.trim()}>
      <div className="notification-content">
        <div className="notification-title">
          {translateText(notification.title)}
        </div>
        {notification.message && (
          <div className="notification-message">
            {translateText(notification.message)}
          </div>
        )}
        <div className="notification-meta">
          {notification.timestamp && (
            <span className="notification-time">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      <button
        className="notification-dismiss"
        onClick={handleDismiss}
        title={translateText("Dismiss")}
        aria-label={translateText("Dismiss notification")}
      >
        ✕
      </button>
    </li>
  );
}

/**
 * Notifications Badge Component
 * Shows notification count and displays recent notifications in a popover
 *
 * Features:
 * - Notification badge with count
 * - Popover with recent notifications
 * - Notification types (info, success, warning, error)
 * - Dismiss individual notifications
 * - Click outside to close
 *
 * Usage:
 * <NotificationsBadge />
 */
export default function NotificationsBadge({ className = "" }) {
  const { notifications, dismissNotification } = useNotifications();
  const { translateText } = useAppLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalCount = notifications.length;

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleDismiss = (notificationId) => {
    dismissNotification(notificationId);
  };

  if (totalCount === 0) {
    return (
      <div className={`notifications-badge ${className}`.trim()}>
        <button
          className="notifications-trigger empty"
          title={translateText("No notifications")}
          aria-label={translateText("Notifications")}
          disabled
        >
          <span className="notifications-icon">🔔</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`notifications-badge ${className}`.trim()}>
      <button
        ref={triggerRef}
        className={`notifications-trigger${isOpen ? " active" : ""}`.trim()}
        onClick={handleToggle}
        title={
          unreadCount > 0
            ? translateText(`${unreadCount} new notifications`)
            : translateText("Notifications")
        }
        aria-label={translateText("Notifications")}
      >
        <span className="notifications-icon">🔔</span>
        {totalCount > 0 && (
          <span className="notifications-badge-count">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
        {unreadCount > 0 && <span className="notifications-unread-indicator" />}
      </button>

      {isOpen && (
        <div ref={popoverRef} className="notifications-popover">
          <div className="notifications-popover-header">
            <h3>{translateText("Notifications")}</h3>
            {totalCount > 0 && (
              <span className="notifications-popover-count">
                {totalCount}
              </span>
            )}
          </div>

          <div className="notifications-popover-content">
            {notifications.length > 0 ? (
              <ul className="notifications-list">
                {notifications.slice(0, 10).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                  />
                ))}
              </ul>
            ) : (
              <div className="notifications-empty">
                <p>{translateText("No notifications")}</p>
              </div>
            )}
          </div>

          {totalCount > 10 && (
            <div className="notifications-popover-footer">
              <button className="notifications-view-all">
                {translateText("View all notifications")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
