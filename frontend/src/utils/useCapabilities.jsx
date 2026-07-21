import { useEffect, useState, useCallback } from "react";
import {
  hasCapability,
  hasAnyCapability,
  hasAllCapabilities,
  getUserCapabilities,
  getCapabilityMetadata,
  getAllCapabilities,
  getCapabilitiesByCategory,
  getCapabilitiesByModule,
  getNavigationItems,
  getQuickActions,
} from "../services/capabilityApi";

/**
 * Hook to check if user has a capability
 */
export function useCapability(capabilityId) {
  const [has, setHas] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hasCapability(capabilityId).then((result) => {
      setHas(result);
      setLoading(false);
    });
  }, [capabilityId]);

  return { has, loading };
}

/**
 * Hook to check if user has any of given capabilities
 */
export function useAnyCapability(capabilityIds) {
  const [has, setHas] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hasAnyCapability(capabilityIds).then((result) => {
      setHas(result);
      setLoading(false);
    });
  }, [capabilityIds]);

  return { has, loading };
}

/**
 * Hook to check if user has all given capabilities
 */
export function useAllCapabilities(capabilityIds) {
  const [has, setHas] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hasAllCapabilities(capabilityIds).then((result) => {
      setHas(result);
      setLoading(false);
    });
  }, [capabilityIds]);

  return { has, loading };
}

/**
 * Hook to get user capabilities with metadata
 */
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllCapabilities()
      .then((caps) => {
        setCapabilities(caps);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load capabilities:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { capabilities, loading, error };
}

/**
 * Hook to get user's capabilities info
 */
export function useUserCapabilitiesInfo() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getUserCapabilities()
      .then((caps) => {
        setInfo(caps);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load capabilities info:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { info, loading, error };
}

/**
 * Hook to get capabilities grouped by category
 */
export function useCapabilitiesByCategory() {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCapabilitiesByCategory()
      .then((cats) => {
        setCategories(cats);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load capabilities by category:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading, error };
}

/**
 * Hook to get capabilities grouped by module
 */
export function useCapabilitiesByModule() {
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCapabilitiesByModule()
      .then((mods) => {
        setModules(mods);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load capabilities by module:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { modules, loading, error };
}

/**
 * Hook to get navigation items
 */
export function useNavigationItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getNavigationItems()
      .then((navItems) => {
        setItems(navItems);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load navigation items:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { items, loading, error };
}

/**
 * Hook to get quick actions
 */
export function useQuickActions() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getQuickActions()
      .then((quickActions) => {
        setActions(quickActions);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load quick actions:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { actions, loading, error };
}

/**
 * Hook to conditionally render based on capability
 * Usage: const { can } = useCanAccess('facility.beds.manage')
 */
export function useCanAccess(capabilityId) {
  const { has, loading } = useCapability(capabilityId);
  return { can: has, loading };
}

/**
 * Conditional render component for capabilities
 */
export function CanAccess({ capability, children, fallback = null }) {
  const { has, loading } = useCapability(capability);

  if (loading) {
    return fallback;
  }

  return has ? children : fallback;
}

/**
 * Conditional render for multiple capabilities (ANY)
 */
export function CanAccessAny({ capabilities, children, fallback = null }) {
  const { has, loading } = useAnyCapability(capabilities);

  if (loading) {
    return fallback;
  }

  return has ? children : fallback;
}

/**
 * Conditional render for multiple capabilities (ALL)
 */
export function CanAccessAll({ capabilities, children, fallback = null }) {
  const { has, loading } = useAllCapabilities(capabilities);

  if (loading) {
    return fallback;
  }

  return has ? children : fallback;
}
