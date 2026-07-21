// Navigation Framework Components

export { default as Sidebar } from "./Sidebar";
export { default as Breadcrumbs } from "./Breadcrumbs";
export { default as CommandPalette } from "./CommandPalette";
export { default as QuickActions } from "./QuickActions";
export { default as NotificationsBadge } from "./NotificationsBadge";

// Navigation hooks are exported from NavigationContext
export {
  NavigationProvider,
  useNavigation,
  useFavorites,
  useRecentPages,
  useNotifications,
  useSidebar,
  useSearch,
} from "../../contexts/NavigationContext";

// Route protection exports
export { RouteGuard, ProtectedRoute, useRouteGuard } from "../RouteGuard";

// Navigation service exports
export {
  favoritesService,
  recentService,
  notificationService,
  sidebarService,
  buildSearchIndex,
  searchIndex,
} from "../../services/navigationService";
