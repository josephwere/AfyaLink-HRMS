import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useNavigation, useRecentPages } from "../contexts/NavigationContext";
import {
  Sidebar,
  Breadcrumbs,
  QuickActions,
} from "../components/Navigation/index";
import "./MainLayout.css";

/**
 * Main Application Layout
 * Integrates all Navigation Framework components
 *
 * Structure:
 * ┌─────────────────────────────────────────────────┐
 * │ Header (Breadcrumbs | QuickActions | Notifications)
 * ├──────────────┬──────────────────────────────────┤
 * │              │                                  │
 * │   Sidebar    │          Content Area            │
 * │   (Fixed)    │         (Main Routes)            │
 * │              │                                  │
 * │              │                                  │
 * └──────────────┴──────────────────────────────────┘
 *
 * Features:
 * - Dynamic sidebar based on user capabilities
 * - Optional breadcrumb navigation
 * - Quick action buttons
 * - Notification badge
 * - Responsive design (sidebar collapses on mobile)
 * - Tracks page visits in recent pages
 */
export default function MainLayout({
  compact = false,
  showBreadcrumbs = false,
  showQuickActions = true,
  showNotifications = true,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { trackPage } = useRecentPages();

  const [banner, setBanner] = React.useState("");

  React.useEffect(() => {
    const info = location.state?.info;
    if (info) {
      setBanner(info);
      // Clear navigation state so banner doesn't persist on refresh
      try {
        navigate(location.pathname, { replace: true, state: {} });
      } catch (e) {
        // ignore
      }
    }
  }, [location.pathname, location.state, navigate]);

  // Track page visit
  React.useEffect(() => {
    const pageTitle = document.title;
    trackPage({
      id: location.pathname,
      title: pageTitle || location.pathname,
      route: location.pathname,
      icon: "📄",
    });
  }, [location.pathname, trackPage]);

  return (
    <div className="main-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPath={location.pathname}
        className="main-layout-sidebar"
        compact={compact}
      />

      {/* Main Content */}
      <div className="main-layout-content">
        {/* Header */}
        <header className="main-layout-header">
          {/* Left: Breadcrumbs */}
          {showBreadcrumbs && (
            <div className="layout-header-left">
              <Breadcrumbs
                currentPath={location.pathname}
                homeLabel="Home"
                homeRoute="/"
              />
            </div>
          )}

          {/* Right: Quick Actions and Controls */}
          <div className="layout-header-right" />
        </header>

        {/* Quick Actions Bar */}
        {showQuickActions && (
          <QuickActions className="layout-quick-actions" />
        )}

        {/* Main Content Area */}
        <main className="main-layout-main">
          {banner && (
            <div className="auth-info-banner card" role="status">
              {banner}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
