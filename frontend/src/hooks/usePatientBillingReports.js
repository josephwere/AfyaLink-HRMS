import { useResource } from "./shared/useResource";
import { listMyReports } from "../services/reportsApi";

export function usePatientBillingReports() {
  return useResource({
    fetcher: async () => listMyReports({ cursorMode: true, limit: 10 }),
    initialData: { items: [] },
    cacheKey: "patient-billing-reports",
  });
}

export default usePatientBillingReports;
