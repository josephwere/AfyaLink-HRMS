import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  favoritesService,
  recentService,
  notificationService,
  sidebarService,
  buildSearchIndex,
  searchIndex as searchIndexService,
} from "../services/navigationService";
import { getUserCapabilities, getNavigationItems } from "../services/capabilityApi";
import { MODULE_REGISTRY } from "../config/moduleRegistry";

/**
 * NavigationContext
 * Provides global navigation state: favorites, recent, notifications, sidebar, search
 */
const NavigationContext = createContext(null);

function normalizeNotifications(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([moduleId, count]) => {
      const safeCount = Number(count) || 0;
      return Array.from({ length: safeCount }, (_, index) => ({
        id: `${moduleId}-${index}`,
        moduleId,
        title: "Notification",
        message: "You have a new update.",
        read: false,
        timestamp: new Date().toISOString(),
      }));
    });
  }

  return [];
}

export function NavigationProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [expandedModules, setExpandedModules] = useState([]);
  const [searchIndexData, setSearchIndexData] = useState([]);
  const [navigationLoading, setNavigationLoading] = useState(true);

  // Initialize navigation state
  useEffect(() => {
    const loadNavigationState = async () => {
      try {
        setNavigationLoading(true);

        // Load local state
        setFavorites(favoritesService.getFavorites());
        setRecent(recentService.getRecent());
        setNotifications(normalizeNotifications(notificationService.getNotifications()));
        setExpandedModules(sidebarService.getExpanded());

        // Build search index from capabilities and modules
        const navItems = await getNavigationItems();
        const index = await buildSearchIndex(navItems, MODULE_REGISTRY);
        setSearchIndexData(index);
      } catch (err) {
        console.error("Failed to load navigation state:", err);
      } finally {
        setNavigationLoading(false);
      }
    };

    loadNavigationState();
  }, []);

  // Favorites handlers
  const addFavorite = useCallback((item) => {
    const updated = favoritesService.addFavorite(item);
    setFavorites(updated);
  }, []);

  const removeFavorite = useCallback((itemId) => {
    const updated = favoritesService.removeFavorite(itemId);
    setFavorites(updated);
  }, []);

  const isFavorite = useCallback(
    (itemId) => favorites.some((f) => f.id === itemId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (item) => {
      if (isFavorite(item.id)) {
        removeFavorite(item.id);
      } else {
        addFavorite(item);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  const clearFavorites = useCallback(() => {
    const updated = favoritesService.clearFavorites();
    setFavorites(updated);
  }, []);

  const reorderFavorites = useCallback((newOrder) => {
    const updated = favoritesService.reorderFavorites(newOrder);
    setFavorites(updated);
  }, []);

  // Recent pages handlers
  const trackPage = useCallback((item) => {
    const updated = recentService.trackPage(item);
    setRecent(updated);
  }, []);

  const clearRecent = useCallback(() => {
    const updated = recentService.clearRecent();
    setRecent(updated);
  }, []);

  // Notifications handlers
  const setNotification = useCallback((moduleId, count) => {
    const updated = notificationService.setNotification(moduleId, count);
    setNotifications(normalizeNotifications(updated));
  }, []);

  const clearNotification = useCallback((moduleId) => {
    const updated = notificationService.clearNotification(moduleId);
    setNotifications(normalizeNotifications(updated));
  }, []);

  const getNotificationCount = useCallback(
    (moduleId) => {
      const source = Array.isArray(notifications) ? notifications : [];
      return source.filter((item) => item?.moduleId === moduleId).length;
    },
    [notifications]
  );

  const getTotalNotifications = useCallback(() => {
    return Array.isArray(notifications) ? notifications.length : 0;
  }, [notifications]);

  // Sidebar handlers
  const toggleExpanded = useCallback((moduleId) => {
    const updated = sidebarService.toggleExpanded(moduleId);
    setExpandedModules(updated);
  }, []);

  const isExpanded = useCallback(
    (moduleId) => expandedModules.includes(moduleId),
    [expandedModules]
  );

  const collapseAll = useCallback(() => {
    const updated = sidebarService.collapseAll();
    setExpandedModules(updated);
  }, []);

  // Search handler
  const search = useCallback(
    (query) => {
      return searchIndexService(searchIndexData, query);
    },
    [searchIndexData]
  );

  const value = {
    // State
    favorites,
    recent,
    notifications,
    expandedModules,
    searchIndex: searchIndexData,
    navigationLoading,

    // Favorites actions
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    reorderFavorites,

    // Recent actions
    trackPage,
    clearRecent,

    // Notification actions
    setNotification,
    clearNotification,
    getNotificationCount,
    getTotalNotifications,

    // Sidebar actions
    toggleExpanded,
    isExpanded,
    collapseAll,

    // Search
    search,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

/**
 * Hook to access navigation context
 */
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}

/**
 * Hook for favorites
 */
export function useFavorites() {
  const { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite } =
    useNavigation();
  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite };
}

/**
 * Hook for recent pages
 */
export function useRecentPages() {
  const { recent, trackPage, clearRecent } = useNavigation();
  return { recent, trackPage, clearRecent };
}

/**
 * Hook for notifications
 */
export function useNotifications() {
  const {
    notifications,
    setNotification,
    clearNotification,
    getNotificationCount,
    getTotalNotifications,
  } = useNavigation();
  return {
    notifications,
    setNotification,
    clearNotification,
    getNotificationCount,
    getTotalNotifications,
  };
}

/**
 * Hook for sidebar
 */
export function useSidebar() {
  const { expandedModules, toggleExpanded, isExpanded, collapseAll } = useNavigation();
  return { expandedModules, toggleExpanded, isExpanded, collapseAll };
}

/**
 * Hook for search
 */
export function useSearch() {
  const { search, searchIndex } = useNavigation();
  return { search, searchIndex };
}
