import { useCallback } from "react";
import { useResource } from "./shared/useResource";
import pharmacyService from "../services/pharmacy";

export function usePharmacy({ q = "", page = 1, limit = 25 } = {}) {
  const fetcher = useCallback(async () => pharmacyService.listItems({ q, page, limit }), [q, page, limit]);

  return useResource({
    fetcher,
    initialData: { items: [], total: 0 },
    cacheKey: ["pharmacy", q, page, limit].join(":"),
    watchKeys: [q, page, limit],
  });
}
