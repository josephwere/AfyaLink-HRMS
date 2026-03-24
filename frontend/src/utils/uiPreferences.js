import { useCallback, useEffect, useRef } from "react";
import apiFetch from "./apiFetch";
import { useAuth } from "./auth";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeUiPreferences(base = {}, patch = {}) {
  const source = isPlainObject(base) ? base : {};
  const incoming = isPlainObject(patch) ? patch : {};
  const next = { ...source };

  Object.entries(incoming).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      next[key] = [...value];
      return;
    }
    if (isPlainObject(value)) {
      next[key] = mergeUiPreferences(source[key], value);
      return;
    }
    next[key] = value;
  });

  return next;
}

export function useUiPreferences() {
  const { user, patchUser } = useAuth();
  const saveTimeoutRef = useRef(null);
  const pendingPrefsRef = useRef(null);

  const flushUiPreferences = useCallback(
    async (prefs = pendingPrefsRef.current, requestOptions = {}) => {
      if (!user || !prefs) return false;
      try {
        await apiFetch("/api/profile", {
          method: "PUT",
          body: { uiPreferences: prefs },
          ...requestOptions,
        });
        pendingPrefsRef.current = null;
        return true;
      } catch {
        return false;
      }
    },
    [user]
  );

  const setUiPreferences = useCallback(
    (patch = {}, options = {}) => {
      if (!user) return null;
      const current = isPlainObject(user.uiPreferences) ? user.uiPreferences : {};
      const next = mergeUiPreferences(current, patch);

      patchUser?.({ uiPreferences: next });
      pendingPrefsRef.current = next;

      if (options.persist === false) return next;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      if (options.immediate) {
        flushUiPreferences(next);
        return next;
      }

      saveTimeoutRef.current = setTimeout(() => {
        flushUiPreferences(next);
      }, Number(options.debounceMs || 300));

      return next;
    },
    [flushUiPreferences, patchUser, user]
  );

  useEffect(() => {
    const flushPending = () => {
      if (!pendingPrefsRef.current) return;
      flushUiPreferences(pendingPrefsRef.current, {
        keepalive: true,
        timeoutMs: 4000,
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPending();
      }
    };

    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushUiPreferences]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    },
    []
  );

  return {
    uiPreferences: isPlainObject(user?.uiPreferences) ? user.uiPreferences : {},
    setUiPreferences,
    flushUiPreferences,
  };
}
