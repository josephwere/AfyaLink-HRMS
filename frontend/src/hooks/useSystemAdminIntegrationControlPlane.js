import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentProfile, updateCurrentProfilePreferences } from "../services/profileApi";
import { getIntegrationControlPlane } from "../services/systemAdminApi";
import { getSystemSettings, updateSystemSettings } from "../services/systemSettingsApi";

export function useSystemAdminIntegrationControlPlane() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const [govConfig, setGovConfig] = useState({
    sha: {
      baseUrl: "",
      tokenUrl: "",
      preauthUrl: "",
      apiToken: "",
      clientId: "",
      clientSecret: "",
      audience: "",
      timeoutMs: 8000,
    },
    etims: {
      baseUrl: "",
      tokenUrl: "",
      invoiceUrl: "",
      apiKey: "",
      apiToken: "",
      clientId: "",
      clientSecret: "",
      timeoutMs: 8000,
    },
  });
  const [showSecrets, setShowSecrets] = useState({
    shaApiToken: false,
    shaClientSecret: false,
    etimsApiKey: false,
    etimsApiToken: false,
    etimsClientSecret: false,
  });
  const [showOnHover, setShowOnHover] = useState(false);
  const [govSaving, setGovSaving] = useState(false);
  const [govMessage, setGovMessage] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async ({ preserveData = false } = {}) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const [res, settings, profile] = await Promise.all([
        getIntegrationControlPlane(),
        getSystemSettings(),
        getCurrentProfile(),
      ]);
      if (requestRef.current !== requestId) return;
      setData(res?.payload || null);
      setClientMeta(res?.clientMeta || null);
      const incoming = settings?.governmentApis || {};
      setShowOnHover(Boolean(profile?.uiPreferences?.showSecretsOnHover));
      setGovConfig({
        sha: {
          baseUrl: incoming?.sha?.baseUrl || "",
          tokenUrl: incoming?.sha?.tokenUrl || "",
          preauthUrl: incoming?.sha?.preauthUrl || "",
          apiToken: incoming?.sha?.apiToken || "",
          clientId: incoming?.sha?.clientId || "",
          clientSecret: incoming?.sha?.clientSecret || "",
          audience: incoming?.sha?.audience || "",
          timeoutMs: incoming?.sha?.timeoutMs || 8000,
        },
        etims: {
          baseUrl: incoming?.etims?.baseUrl || "",
          tokenUrl: incoming?.etims?.tokenUrl || "",
          invoiceUrl: incoming?.etims?.invoiceUrl || "",
          apiKey: incoming?.etims?.apiKey || "",
          apiToken: incoming?.etims?.apiToken || "",
          clientId: incoming?.etims?.clientId || "",
          clientSecret: incoming?.etims?.clientSecret || "",
          timeoutMs: incoming?.etims?.timeoutMs || 8000,
        },
      });
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err?.message || "Failed to load integration control plane");
      if (!preserveData) setData(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ preserveData: false });
  }, [load]);

  const saveGovConfig = useCallback(async () => {
    setGovSaving(true);
    setGovMessage("");
    try {
      await updateSystemSettings({ governmentApis: govConfig });
      setGovMessage("Government API credentials saved.");
      await load({ preserveData: true });
    } catch (err) {
      setGovMessage(err?.message || "Failed to save government API credentials.");
    } finally {
      setGovSaving(false);
    }
  }, [govConfig, load]);

  const saveHoverPreference = useCallback(async (nextValue) => {
    setShowOnHover(nextValue);
    try {
      await updateCurrentProfilePreferences({ showSecretsOnHover: nextValue });
      setGovMessage("Preference saved.");
    } catch (err) {
      setGovMessage(err?.message || "Failed to save preference.");
    }
  }, []);

  const toggleSecret = useCallback((key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const hoverSecret = useCallback((key, value) => {
    if (!showOnHover) return;
    setShowSecrets((prev) => ({ ...prev, [key]: value }));
  }, [showOnHover]);

  return {
    data,
    loading,
    error,
    clientMeta,
    govConfig,
    setGovConfig,
    showSecrets,
    setShowSecrets,
    showOnHover,
    setShowOnHover,
    govSaving,
    govMessage,
    setGovMessage,
    load,
    saveGovConfig,
    saveHoverPreference,
    toggleSecret,
    hoverSecret,
  };
}

export default useSystemAdminIntegrationControlPlane;
