import { useCallback } from "react";
import {
  createRegisteredPharmacy as createRegisteredPharmacyApi,
  listRegisteredPharmacies as listRegisteredPharmaciesApi,
  updateRegisteredPharmacy as updateRegisteredPharmacyApi,
} from "../services/pharmacyNetworkApi";

export function usePharmaciesPage() {
  const listRegisteredPharmacies = useCallback((params) => listRegisteredPharmaciesApi(params), []);
  const createRegisteredPharmacy = useCallback((payload) => createRegisteredPharmacyApi(payload), []);
  const updateRegisteredPharmacy = useCallback((id, payload) => updateRegisteredPharmacyApi(id, payload), []);

  return {
    listRegisteredPharmacies,
    createRegisteredPharmacy,
    updateRegisteredPharmacy,
  };
}

export default usePharmaciesPage;
