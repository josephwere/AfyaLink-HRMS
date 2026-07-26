import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getResourceCache,
  invalidateResourceCache,
  setResourceCache,
} from "../../services/shared/resourceCache";

export function useResource({
  fetcher,
  initialData = null,
  watchKeys = [],
  onError,
  onSuccess,
  cacheKey,
} = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const hasLoadedOnce = useRef(false);
  const lastWatchKey = useRef(null);
  const requestIdRef = useRef(0);
  const loadRef = useRef(null);

  const key = cacheKey;

  const load = useCallback(
    async (...args) => {
      if (typeof fetcher !== "function") {
        throw new Error("useResource requires a fetcher function");
      }

      const requestId = ++requestIdRef.current;

      if (mounted.current) {
        setLoading(true);
        setError(null);
      }

      if (key && hasLoadedOnce.current) {
        const cachedValue = getResourceCache(key);
        if (cachedValue !== undefined) {
          if (mounted.current && requestId === requestIdRef.current) {
            setData(cachedValue);
            setLoading(false);
          }
          return cachedValue;
        }
      }

      try {
        const result = await fetcher(...args);

        if (key) {
          setResourceCache(key, result);
          hasLoadedOnce.current = true;
        }

        if (mounted.current && requestId === requestIdRef.current) {
          setData(result);
          setLoading(false);
          setError(null);
        }

        if (typeof onSuccess === "function") {
          onSuccess(result);
        }
        return result;
      } catch (err) {
        if (mounted.current && requestId === requestIdRef.current) {
          setData(initialData ?? null);
          setError(err);
          setLoading(false);
        }

        if (typeof onError === "function") {
          onError(err);
        }
        throw err;
      }
    },
    [fetcher, key, initialData, onError, onSuccess]
  );

  const refresh = useCallback(async () => {
    if (key) {
      invalidateResourceCache(key);
    }
    hasLoadedOnce.current = false;
    return load();
  }, [key, load]);

  loadRef.current = load;

  const clear = useCallback(() => {
    if (!mounted.current) return;
    hasLoadedOnce.current = false;
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  useEffect(() => {
    mounted.current = true;
    const watchKey = JSON.stringify(watchKeys);

    if (lastWatchKey.current === watchKey) {
      return () => {
        mounted.current = false;
      };
    }

    lastWatchKey.current = watchKey;
    if (key) {
      invalidateResourceCache(key);
    }
    hasLoadedOnce.current = false;

    loadRef.current().catch(() => {});

    return () => {
      mounted.current = false;
    };
  }, [key, ...watchKeys]);

  const derived = useMemo(
    () => ({ data, loading, error, isReady: !loading && !error && data !== null }),
    [data, error, loading]
  );

  return {
    ...derived,
    data,
    loading,
    error,
    refresh,
    clear,
    load,
  };
}
