import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { getNavigationItemsForCapabilities } from "../../config/moduleRegistry";
import { useUserCapabilitiesInfo } from "../../utils/useCapabilities";
import { canonicalizePath } from "../../app/routing/canonicalizePath";
import "./Breadcrumbs.css";

/**
 * Breadcrumb Item Component
 */
function BreadcrumbItem({ label, route, isLast, onClick }) {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();

  const handleClick = (e) => {
    e.preventDefault();
    if (!isLast && route) {
      const path = canonicalizePath(route);
      if (path) {
        navigate(path);
        onClick?.();
      }
    }
  };

  return (
    <li className={`breadcrumb-item${isLast ? " current" : ""}`.trim()}>
      {!isLast && route ? (
        <button className="breadcrumb-link" onClick={handleClick}>
          {translateText(label)}
        </button>
      ) : (
        <span className="breadcrumb-text">{translateText(label)}</span>
      )}
      {!isLast && <span className="breadcrumb-sep">›</span>}
    </li>
  );
}

/**
 * Breadcrumbs Component
 * Generates breadcrumbs from current path and navigation metadata
 *
 * Usage:
 * <Breadcrumbs currentPath="/hospital-admin/facility/beds" />
 */
export default function Breadcrumbs({ currentPath, homeLabel = "Home", homeRoute = "/" }) {
  const { info: capabilitiesInfo } = useUserCapabilitiesInfo();
  const { translateText } = useAppLanguage();

  if (!capabilitiesInfo) {
    return null;
  }

  const capabilities = capabilitiesInfo.capabilities || [];
  const navigationItems = getNavigationItemsForCapabilities(capabilities);

  // Build breadcrumbs
  const breadcrumbs = [{ label: homeLabel, route: homeRoute }];

  // Try to match current path to navigation items
  if (currentPath && currentPath !== "/") {
    const pathSegments = currentPath.split("/").filter(Boolean);

    // Find matching navigation item
    const matchingItem = navigationItems.find((item) => {
      const itemPath = canonicalizePath(item.route);
      return itemPath && itemPath.includes(pathSegments[pathSegments.length - 1]);
    });

    if (matchingItem) {
      // Add module
      breadcrumbs.push({
        label: matchingItem.moduleName,
        route: null, // Will be set to first item in module
      });

      // Add current page
      breadcrumbs.push({
        label: matchingItem.title,
        route: matchingItem.route,
      });
    } else {
      // Fallback: build from path segments
      let accumulatedPath = "";
      pathSegments.forEach((segment, index) => {
        accumulatedPath += `/${segment}`;
        const label = segment
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        breadcrumbs.push({
          label,
          route: index < pathSegments.length - 1 ? accumulatedPath : null,
        });
      });
    }
  }

  // Mark last item
  const breadcrumbsWithLast = breadcrumbs.map((crumb, index) => ({
    ...crumb,
    isLast: index === breadcrumbs.length - 1,
  }));

  return (
    <nav className="breadcrumbs" aria-label={translateText("Breadcrumbs")}>
      <ol className="breadcrumbs-list">
        {breadcrumbsWithLast.map((crumb, index) => (
          <BreadcrumbItem
            key={`${crumb.label}-${index}`}
            label={crumb.label}
            route={crumb.route}
            isLast={crumb.isLast}
          />
        ))}
      </ol>
    </nav>
  );
}
