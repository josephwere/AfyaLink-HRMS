import { useCallback } from "react";
import { useResource } from "./shared/useResource";
import { useMutation } from "./shared/useMutation";

export function createDomainHook({
  service,
  resourceKey,
  fetcher,
  initialData = null,
  watchKeys = [],
  mutations = {},
  mapResult = (value) => value,
} = {}) {
  if (!service) {
    throw new Error("createDomainHook requires a service");
  }

  return function useDomainHook(params = {}) {
    const normalizedParams = params ?? {};
    const resource = useResource({
      fetcher: useCallback(
        async (...args) => {
          if (typeof fetcher === "function") {
            return fetcher(normalizedParams, ...args);
          }
          return service.list?.(normalizedParams);
        },
        [fetcher, normalizedParams]
      ),
      initialData,
      cacheKey: resourceKey ? `${resourceKey}:${JSON.stringify(normalizedParams)}` : undefined,
      watchKeys: watchKeys.length ? watchKeys : [JSON.stringify(normalizedParams)],
    });

    const mutationHandlers = Object.entries(mutations).reduce((acc, [key, mutationConfig]) => {
      const action = mutationConfig.action || service[mutationConfig.name];
      if (!action) {
        return acc;
      }

      const invalidate = mutationConfig.invalidate === true ? resource.refresh : mutationConfig.invalidate || resource.refresh;
      const mutation = useMutation({
        action,
        invalidate,
        optimistic: mutationConfig.optimistic,
        onSuccess: mutationConfig.onSuccess,
        onError: mutationConfig.onError,
      });

      acc[key] = useCallback((...args) => mutation.execute(...args), [mutation]);
      acc[`${key}Loading`] = mutation.loading;
      acc[`${key}Error`] = mutation.error;
      return acc;
    }, {});

    return {
      ...resource,
      data: mapResult(resource.data),
      ...mutationHandlers,
    };
  };
}

export default createDomainHook;
