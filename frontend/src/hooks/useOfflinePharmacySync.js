import { useCallback } from "react";
import idbPharmacy from "../services/idbPharmacy";

export function useOfflinePharmacySync() {
  return useCallback(async ({ onSync, onError } = {}) => {
    try {
      await idbPharmacy.syncPending();
      if (typeof onSync === "function") {
        await onSync();
      }
    } catch (error) {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  }, []);
}

export default useOfflinePharmacySync;
