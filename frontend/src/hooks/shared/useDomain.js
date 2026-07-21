import { useCallback, useMemo } from "react";
import { useResource } from "./useResource";
import { useMutation } from "./useMutation";

export function useDomain(domain, { primaryQuery = null, params = {} } = {}) {
  if (!domain) {
    throw new Error("useDomain requires a domain");
  }

  const { name, queries = {}, commands = {}, cache } = domain;

  const fetcher = useCallback(async () => {
    if (!primaryQuery || typeof queries[primaryQuery] !== "function") {
      return null;
    }
    return queries[primaryQuery](params);
  }, [primaryQuery, queries, params]);

  const cacheKey = primaryQuery ? [name, primaryQuery, JSON.stringify(params)].join(":") : null;

  const resource = useResource({
    fetcher,
    initialData: null,
    cacheKey,
    watchKeys: [primaryQuery, params],
  });

  const boundCommands = useMemo(() => {
    return Object.keys(commands).reduce((acc, cmdName) => {
      const cmd = commands[cmdName];
      acc[cmdName] = useMutation({
        action: cmd,
        invalidate: () => resource.refresh(),
      });
      return acc;
    }, {});
  }, [commands, resource]);

  return {
    ...resource,
    commands: boundCommands,
    domain,
  };
}

export default useDomain;
