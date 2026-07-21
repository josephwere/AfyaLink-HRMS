import { useCallback } from "react";
import {
  getAssetDeliveryHealth as getAssetDeliveryHealthApi,
  getEmailDeliveryHealth as getEmailDeliveryHealthApi,
  getSystemSettings as getSystemSettingsApi,
  getSystemSettingsHistory as getSystemSettingsHistoryApi,
  restoreSystemSettingsRevision as restoreSystemSettingsRevisionApi,
  updateSystemSettings as updateSystemSettingsApi,
} from "../services/systemSettingsApi";

export function useSystemSettingsPage() {
  const getSystemSettings = useCallback(() => getSystemSettingsApi(), []);
  const getSystemSettingsHistory = useCallback(() => getSystemSettingsHistoryApi(), []);
  const restoreSystemSettingsRevision = useCallback((revisionId) => restoreSystemSettingsRevisionApi(revisionId), []);
  const getEmailDeliveryHealth = useCallback(() => getEmailDeliveryHealthApi(), []);
  const getAssetDeliveryHealth = useCallback(() => getAssetDeliveryHealthApi(), []);
  const updateSystemSettings = useCallback((payload) => updateSystemSettingsApi(payload), []);

  return {
    getSystemSettings,
    getSystemSettingsHistory,
    restoreSystemSettingsRevision,
    getEmailDeliveryHealth,
    getAssetDeliveryHealth,
    updateSystemSettings,
  };
}

export default useSystemSettingsPage;
