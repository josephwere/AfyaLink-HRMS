import React from "react";
import { Navigate } from "react-router-dom";
import { hasCapability, hasAnyCapability, hasAllCapabilities } from "../services/capabilityApi";
import { useAuth } from "../utils/auth";

/**
 * RouteGuard Component
 * Protects routes based on user capabilities
 *
 * Usage:
 * <RouteGuard capability="facility.beds.manage">
 *   <BedsPage />
 * </RouteGuard>
 *
 * With multiple capabilities (OR):
 * <RouteGuard anyCapability={["users.manage", "users.view"]}>
 *   <StaffPage />
 * </RouteGuard>
 *
 * With multiple capabilities (AND):
 * <RouteGuard allCapabilities={["users.manage", "audit.logs.view"]}>
 *   <AdminPage />
 * </RouteGuard>
 */
export function RouteGuard({
  capability,
  anyCapability,
  allCapabilities,
  children,
  fallback = null,
  redirectTo = "/unauthorized",
  loading = null,
}) {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    const checkAccess = async () => {
      try {
        setChecking(true);

        let allowed = false;

        if (capability) {
          allowed = await hasCapability(capability);
        } else if (anyCapability && Array.isArray(anyCapability)) {
          allowed = await hasAnyCapability(anyCapability);
        } else if (allCapabilities && Array.isArray(allCapabilities)) {
          allowed = await hasAllCapabilities(allCapabilities);
        } else {
          // No capability check, allow access
          allowed = true;
        }

        setHasAccess(allowed);
      } catch (err) {
        console.error("RouteGuard capability check failed:", err);
        setHasAccess(false);
      } finally {
        setChecking(false);
      }
    };

    if (!authLoading && user) {
      checkAccess();
    }
  }, [capability, anyCapability, allCapabilities, authLoading, user]);

  // Still loading auth for a first-time restore, but an already-authenticated user
  // should be allowed to continue immediately rather than being stuck on a skeleton.
  if (authLoading && !user) {
    return loading || null;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Checking capabilities
  if (checking) {
    return loading || null;
  }

  // Capability check passed
  if (hasAccess) {
    return children;
  }

  // Capability check failed - show fallback or redirect
  if (fallback) {
    return fallback;
  }

  return <Navigate to={redirectTo} replace />;
}

/**
 * useRouteGuard Hook
 * Check if user has access to a route
 */
export function useRouteGuard(
  capability,
  anyCapability,
  allCapabilities
) {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    const checkAccess = async () => {
      try {
        setChecking(true);

        let allowed = false;

        if (capability) {
          allowed = await hasCapability(capability);
        } else if (anyCapability && Array.isArray(anyCapability)) {
          allowed = await hasAnyCapability(anyCapability);
        } else if (allCapabilities && Array.isArray(allCapabilities)) {
          allowed = await hasAllCapabilities(allCapabilities);
        } else {
          allowed = true;
        }

        setHasAccess(allowed);
      } catch (err) {
        console.error("useRouteGuard check failed:", err);
        setHasAccess(false);
      } finally {
        setChecking(false);
      }
    };

    if (!authLoading && user) {
      checkAccess();
    }
  }, [capability, anyCapability, allCapabilities, authLoading, user]);

  return {
    hasAccess,
    checking,
    isAuthenticated: !!user,
  };
}

/**
 * ProtectedRoute Component for React Router
 * Use this in route definitions to protect routes
 *
 * Usage in router config:
 * {
 *   path: "/facility/beds",
 *   element: <ProtectedRoute capability="facility.beds.manage" element={<BedsPage />} />
 * }
 */
export function ProtectedRoute({
  capability,
  anyCapability,
  allCapabilities,
  element,
}) {
  return (
    <RouteGuard
      capability={capability}
      anyCapability={anyCapability}
      allCapabilities={allCapabilities}
      redirectTo="/unauthorized"
    >
      {element}
    </RouteGuard>
  );
}
