import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import {
  listNotificationsFiltered,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../services/notificationsApi";

export function useNotificationsPage({ user, location, navigate }) {
  const resolvedNavigate = navigate || (() => {});
  const role = String(user?.actualRole || user?.role || "").toUpperCase();
  const canTrainingOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"].includes(role);
  const canMachineOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  const canSlaOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"].includes(role);
  const canPharmacyOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "PHARMACIST"].includes(role);

  const queryFilters = useMemo(() => {
    const params = new URLSearchParams(location?.search || "");
    return {
      category: params.get("category") || "ALL",
      read: params.get("read") || "ALL",
    };
  }, [location?.search]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(queryFilters.category);
  const [read, setRead] = useState(queryFilters.read);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setCategory(queryFilters.category);
    setRead(queryFilters.read);
  }, [queryFilters.category, queryFilters.read]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const readParam = read === "ALL" ? undefined : read === "READ" ? "true" : "false";
      const data = await listNotificationsFiltered({ category, read: readParam });
      if (Array.isArray(data)) setItems(data);
      else if (Array.isArray(data?.items)) setItems(data.items);
      else setItems([]);
    } catch (err) {
      setItems([]);
      setMsg(err?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [category, read]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setMsg("All notifications marked as read.");
    } catch (err) {
      setMsg(err?.message || "Failed to mark notifications as read");
    }
  }, []);

  const toggleNotification = useCallback(async (notification) => {
    try {
      if (notification.read) {
        await markNotificationUnread(notification._id);
        setItems((prev) => prev.map((item) => (item._id === notification._id ? { ...item, read: false } : item)));
      } else {
        await markNotificationRead(notification._id);
        setItems((prev) => prev.map((item) => (item._id === notification._id ? { ...item, read: true } : item)));
      }
    } catch (err) {
      setMsg(err?.message || "Failed to update notification");
    }
  }, []);

  return {
    navigate: resolvedNavigate,
    canTrainingOps,
    canMachineOps,
    canSlaOps,
    canPharmacyOps,
    items,
    loading,
    category,
    setCategory,
    read,
    setRead,
    msg,
    setMsg,
    loadNotifications,
    markAllRead,
    toggleNotification,
  };
}

export default useNotificationsPage;
