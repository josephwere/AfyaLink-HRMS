import { useCallback, useState } from "react";

export function useMutation({ action, invalidate, optimistic, onSuccess, onError } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      if (typeof action !== "function") {
        throw new Error("useMutation requires an action function");
      }

      setLoading(true);
      setError(null);

      try {
        const result = await action(...args);
        if (typeof onSuccess === "function") {
          onSuccess(result);
        }
        if (typeof invalidate === "function") {
          await invalidate(result);
        }
        return result;
      } catch (err) {
        setError(err);
        if (typeof onError === "function") {
          onError(err);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [action, invalidate, onError, onSuccess]
  );

  return {
    execute,
    loading,
    error,
    reset: () => setError(null),
  };
}
