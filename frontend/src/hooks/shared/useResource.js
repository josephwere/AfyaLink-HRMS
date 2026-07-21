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
  const [data, setData] = useState(() => {
    if (cacheKey) {
      const cached = getResourceCache(cacheKey);
      return cached !== undefined ? cached : initialData;
    }
    return initialData;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const currentRequest = useRef(0);
  const mounted = useRef(true);

  const key = cacheKey;

  const load = useCallback(
    async (...args) => {
      if (typeof fetcher !== "function") {
        throw new Error("useResource requires a fetcher function");
      }

      const requestId = ++currentRequest.current;
      if (mounted.current) {
        setLoading(true);
        setError(null);
      }

      if (key) {
        const cachedValue = getResourceCache(key);
        if (cachedValue !== undefined) {
          if (mounted.current && requestId === currentRequest.current) {
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
        }

        if (mounted.current && requestId === currentRequest.current) {
          setData(result);
          setLoading(false);
        }
        if (typeof onSuccess === "function") {
          onSuccess(result);
        }
        return result;
      } catch (err) {
        if (mounted.current && requestId === currentRequest.current) {
          setError(err);
          setLoading(false);
        }
        if (typeof onError === "function") {
          onError(err);
        }
        throw err;
      }
    },
    [fetcher, key, onError, onSuccess]
  );

  const refresh = useCallback(async () => {
    if (key) {
      invalidateResourceCache(key);
    }
    return load();
  }, [key, load]);

  const clear = useCallback(() => {
    if (!mounted.current) return;
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  useEffect(() => {
    mounted.current = true;
    load().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [load, ...watchKeys]);

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
