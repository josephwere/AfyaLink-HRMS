import { useCallback } from "react";
import { useResource } from "./shared/useResource";
import encounterService from "../services/encounter/service";
import laboratoryService from "../services/laboratory/service";

export function useLabQueue() {
  const resource = useResource({
    fetcher: async () => encounterService.listEncounters?.({ stage: "LAB" }),
    initialData: [],
    cacheKey: "lab-queue-encounters",
  });

  const completeEncounterLab = useCallback(async (encounterId) => {
    const result = await laboratoryService.completeEncounterLab?.(encounterId);
    await resource.refresh();
    return result;
  }, [resource]);

  return {
    encounters: Array.isArray(resource.data) ? resource.data : [],
    loading: resource.loading,
    error: resource.error,
    refresh: resource.refresh,
    completeEncounterLab,
  };
}

export default useLabQueue;
