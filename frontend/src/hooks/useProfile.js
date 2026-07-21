import { useCallback } from "react";
import {
  changePassword,
  deleteAccount,
  disableTotp,
  exportAccountData,
  getFamilyMonitoring,
  linkFamilyMinor,
  loadProfileWorkspace as loadProfileWorkspaceApi,
  requestPhoneOtp,
  resendVerificationEmail,
  saveFamilyPreferences,
  searchFamilyProfiles,
  setupTotp,
  toggleTwoFactor,
  unlinkFamilyMinor,
  updateProfileField,
  updateProfileSection,
  verifyPhoneOtp,
  verifyTotp,
} from "../services/profileApi";

export function useProfile() {
  const loadProfileWorkspace = useCallback(async (options = {}) => loadProfileWorkspaceApi(options), []);
  const updateProfileSectionHandler = useCallback(async (payload) => updateProfileSection(payload), []);
  const saveFamilyPreferencesHandler = useCallback(async (payload) => saveFamilyPreferences(payload), []);
  const getFamilyMonitoringHandler = useCallback(async () => getFamilyMonitoring(), []);
  const searchFamilyProfilesHandler = useCallback(async (params) => searchFamilyProfiles(params), []);
  const linkFamilyMinorHandler = useCallback(async (payload) => linkFamilyMinor(payload), []);
  const unlinkFamilyMinorHandler = useCallback(async (patientId) => unlinkFamilyMinor(patientId), []);
  const toggleTwoFactorHandler = useCallback(async (payload) => toggleTwoFactor(payload), []);
  const setupTotpHandler = useCallback(async () => setupTotp(), []);
  const verifyTotpHandler = useCallback(async (payload) => verifyTotp(payload), []);
  const disableTotpHandler = useCallback(async (payload) => disableTotp(payload), []);
  const resendVerificationEmailHandler = useCallback(async (payload) => resendVerificationEmail(payload), []);
  const updateProfileFieldHandler = useCallback(async (payload) => updateProfileField(payload), []);
  const requestPhoneOtpHandler = useCallback(async (payload) => requestPhoneOtp(payload), []);
  const verifyPhoneOtpHandler = useCallback(async (payload) => verifyPhoneOtp(payload), []);
  const changePasswordHandler = useCallback(async (payload) => changePassword(payload), []);
  const exportAccountDataHandler = useCallback(async () => exportAccountData(), []);
  const deleteAccountHandler = useCallback(async (payload) => deleteAccount(payload), []);

  return {
    loadProfileWorkspace,
    updateProfileSection: updateProfileSectionHandler,
    saveFamilyPreferences: saveFamilyPreferencesHandler,
    getFamilyMonitoring: getFamilyMonitoringHandler,
    searchFamilyProfiles: searchFamilyProfilesHandler,
    linkFamilyMinor: linkFamilyMinorHandler,
    unlinkFamilyMinor: unlinkFamilyMinorHandler,
    toggleTwoFactor: toggleTwoFactorHandler,
    setupTotp: setupTotpHandler,
    verifyTotp: verifyTotpHandler,
    disableTotp: disableTotpHandler,
    resendVerificationEmail: resendVerificationEmailHandler,
    updateProfileField: updateProfileFieldHandler,
    requestPhoneOtp: requestPhoneOtpHandler,
    verifyPhoneOtp: verifyPhoneOtpHandler,
    changePassword: changePasswordHandler,
    exportAccountData: exportAccountDataHandler,
    deleteAccount: deleteAccountHandler,
  };
}

export default useProfile;
