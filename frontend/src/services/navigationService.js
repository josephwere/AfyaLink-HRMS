/**
 * Navigation Service
 * Manages favorites, recent pages, notifications, and navigation state
 * Persists to localStorage for favorites and recent pages
 */

const STORAGE_KEY_FAVORITES = "afyalink_nav_favorites";
const STORAGE_KEY_RECENT = "afyalink_nav_recent";
const STORAGE_KEY_NOTIFICATIONS = "afyalink_nav_notifications";
const MAX_RECENT_ITEMS = 10;

/**
 * Favorites Management
 */
export const favoritesService = {
  /**
   * Get all favorites for current user
   */
  getFavorites() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FAVORITES);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to get favorites:", err);
      return [];
    }
  },

  /**
   * Add a favorite
   */
  addFavorite(item) {
    try {
      const favorites = this.getFavorites();
      if (!favorites.find((f) => f.id === item.id)) {
        favorites.push({
          id: item.id,
          title: item.title,
          route: item.route,
          icon: item.icon,
          module: item.module,
          addedAt: new Date().toISOString(),
        });
        localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
      }
      return favorites;
    } catch (err) {
      console.error("Failed to add favorite:", err);
      return this.getFavorites();
    }
  },

  /**
   * Remove a favorite
   */
  removeFavorite(itemId) {
    try {
      const favorites = this.getFavorites().filter((f) => f.id !== itemId);
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
      return favorites;
    } catch (err) {
      console.error("Failed to remove favorite:", err);
      return this.getFavorites();
    }
  },

  /**
   * Check if item is favorited
   */
  isFavorite(itemId) {
    return this.getFavorites().some((f) => f.id === itemId);
  },

  /**
   * Clear all favorites
   */
  clearFavorites() {
    try {
      localStorage.removeItem(STORAGE_KEY_FAVORITES);
      return [];
    } catch (err) {
      console.error("Failed to clear favorites:", err);
      return this.getFavorites();
    }
  },

  /**
   * Reorder favorites
   */
  reorderFavorites(newOrder) {
    try {
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(newOrder));
      return newOrder;
    } catch (err) {
      console.error("Failed to reorder favorites:", err);
      return this.getFavorites();
    }
  },
};

/**
 * Recent Pages Management
 */
export const recentService = {
  /**
   * Get recent pages
   */
  getRecent() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RECENT);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to get recent pages:", err);
      return [];
    }
  },

  /**
   * Track a page visit
   */
  trackPage(item) {
    try {
      const recent = this.getRecent();
      // Remove if already exists to move it to top
      const filtered = recent.filter((r) => r.route !== item.route);
      // Add to front
      const updated = [
        {
          id: item.id,
          title: item.title,
          route: item.route,
          icon: item.icon,
          module: item.module,
          visitedAt: new Date().toISOString(),
        },
        ...filtered,
      ].slice(0, MAX_RECENT_ITEMS);

      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.error("Failed to track page:", err);
      return this.getRecent();
    }
  },

  /**
   * Clear recent history
   */
  clearRecent() {
    try {
      localStorage.removeItem(STORAGE_KEY_RECENT);
      return [];
    } catch (err) {
      console.error("Failed to clear recent:", err);
      return this.getRecent();
    }
  },
};

/**
 * Notifications Management
 * Tracks badge counts per module
 */
export const notificationService = {
  /**
   * Get notifications
   */
  getNotifications() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      console.error("Failed to get notifications:", err);
      return {};
    }
  },

  /**
   * Set notification count for a module
   */
  setNotification(moduleId, count) {
    try {
      const notifications = this.getNotifications();
      notifications[moduleId] = count;
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
      return notifications;
    } catch (err) {
      console.error("Failed to set notification:", err);
      return this.getNotifications();
    }
  },

  /**
   * Get notification count for a module
   */
  getNotificationCount(moduleId) {
    return this.getNotifications()[moduleId] || 0;
  },

  /**
   * Clear notification for a module
   */
  clearNotification(moduleId) {
    try {
      const notifications = this.getNotifications();
      delete notifications[moduleId];
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
      return notifications;
    } catch (err) {
      console.error("Failed to clear notification:", err);
      return this.getNotifications();
    }
  },

  /**
   * Get total notification count
   */
  getTotalCount() {
    const notifications = this.getNotifications();
    return Object.values(notifications).reduce((sum, count) => sum + (count || 0), 0);
  },
};

/**
 * Sidebar State Management
 */
export const sidebarService = {
  STORAGE_KEY_EXPANDED: "afyalink_sidebar_expanded",

  /**
   * Get expanded modules
   */
  getExpanded() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_EXPANDED);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to get expanded modules:", err);
      return [];
    }
  },

  /**
   * Toggle module expansion
   */
  toggleExpanded(moduleId) {
    try {
      const expanded = this.getExpanded();
      const index = expanded.indexOf(moduleId);
      if (index > -1) {
        expanded.splice(index, 1);
      } else {
        expanded.push(moduleId);
      }
      localStorage.setItem(this.STORAGE_KEY_EXPANDED, JSON.stringify(expanded));
      return expanded;
    } catch (err) {
      console.error("Failed to toggle expanded:", err);
      return this.getExpanded();
    }
  },

  /**
   * Check if module is expanded
   */
  isExpanded(moduleId) {
    return this.getExpanded().includes(moduleId);
  },

  /**
   * Expand all modules
   */
  expandAll() {
    try {
      // This would require knowing all module IDs
      // For now, just return current state
      return this.getExpanded();
    } catch (err) {
      console.error("Failed to expand all:", err);
      return this.getExpanded();
    }
  },

  /**
   * Collapse all modules
   */
  collapseAll() {
    try {
      localStorage.setItem(this.STORAGE_KEY_EXPANDED, JSON.stringify([]));
      return [];
    } catch (err) {
      console.error("Failed to collapse all:", err);
      return this.getExpanded();
    }
  },
};

/**
 * Search Index Generation
 * Creates searchable index from capabilities and modules
 */
export async function buildSearchIndex(capabilitiesWithMetadata, modules) {
  const index = [];

  // Add capabilities to index
  if (Array.isArray(capabilitiesWithMetadata)) {
    capabilitiesWithMetadata.forEach((cap) => {
      index.push({
        id: `capability-${cap.id}`,
        type: "capability",
        title: cap.title,
        description: cap.description,
        icon: cap.icon,
        route: cap.route,
        keywords: [cap.title, cap.description, cap.category, cap.module].filter(Boolean),
      });
    });
  }

  // Add modules to index
  if (modules) {
    Object.values(modules).forEach((module) => {
      // Module itself
      index.push({
        id: `module-${module.id}`,
        type: "module",
        title: module.name,
        description: module.description,
        icon: module.icon,
        route: module.navigationItems?.[0]?.route,
        keywords: [module.name, module.description, module.category].filter(Boolean),
      });

      // Module navigation items
      if (Array.isArray(module.navigationItems)) {
        module.navigationItems.forEach((item) => {
          index.push({
            id: `nav-${item.id}`,
            type: "navigation",
            title: item.title,
            description: item.description,
            icon: item.icon,
            route: item.route,
            module: module.id,
            keywords: [item.title, item.description, module.name].filter(Boolean),
          });
        });
      }

      // Quick actions
      if (Array.isArray(module.navigationItems)) {
        module.navigationItems.forEach((item) => {
          if (item.quickAction) {
            index.push({
              id: `action-${item.id}`,
              type: "action",
              title: item.quickAction,
              description: `${item.quickAction} in ${item.title}`,
              icon: item.icon,
              route: item.route,
              module: module.id,
              keywords: [item.quickAction, item.title, module.name].filter(Boolean),
            });
          }
        });
      }
    });
  }

  return index;
}

/**
 * Search function
 * Performs fuzzy search on index
 */
export function searchIndex(index, query) {
  if (!query || query.length < 1) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const results = [];

  index.forEach((item) => {
    let score = 0;

    // Exact match in title
    if (item.title.toLowerCase() === lowerQuery) {
      score = 1000;
    }
    // Title starts with query
    else if (item.title.toLowerCase().startsWith(lowerQuery)) {
      score = 500;
    }
    // Query in title
    else if (item.title.toLowerCase().includes(lowerQuery)) {
      score = 300;
    }
    // Keyword match
    else if (item.keywords?.some((kw) => kw?.toLowerCase().includes(lowerQuery))) {
      score = 100;
    }

    if (score > 0) {
      results.push({ ...item, score });
    }
  });

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}
