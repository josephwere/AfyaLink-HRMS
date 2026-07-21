import { useCallback, useEffect, useState } from "react";
import { listConnectors, saveConnector, testConnector, testConnectorFhir } from "../services/connectorsApi";

const defaultForm = {
  name: "",
  type: "rest",
  url: "",
  apiKey: "",
  authType: "none",
  username: "",
  password: "",
  retryPolicy: { attempts: 5, backoffType: "exponential", backoffDelay: 1000 },
};

export function useAdminIntegrations() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConnectors();
      setList(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const data = await saveConnector(form);
      setTestResult({ message: `Saved: ${data?._id || "connector"}` });
      await load();
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const test = useCallback(async (id) => {
    setTestResult({ message: "Running connection check...", details: "" });
    try {
      const data = await testConnector(id);
      setTestResult({
        message: data?.ok ? "Connection successful." : "Connection check completed.",
        details: data ? JSON.stringify(data, null, 2) : "",
      });
    } catch (e) {
      setTestResult({
        message: e?.message || "Connection check failed.",
        details: JSON.stringify({ message: e?.message, status: e?.status, code: e?.code }, null, 2),
      });
    }
  }, []);

  const testFhir = useCallback(async (id) => {
    setTestResult({ message: "Running FHIR check...", details: "" });
    try {
      const data = await testConnectorFhir(id);
      setTestResult({
        message: data?.ok ? "FHIR check successful." : "FHIR check completed.",
        details: data ? JSON.stringify(data, null, 2) : "",
      });
    } catch (e) {
      setTestResult({
        message: e?.message || "FHIR check failed.",
        details: JSON.stringify({ message: e?.message, status: e?.status, code: e?.code }, null, 2),
      });
    }
  }, []);

  return {
    list,
    form,
    setForm,
    testResult,
    setTestResult,
    loading,
    saving,
    load,
    save,
    test,
    testFhir,
  };
}

export default useAdminIntegrations;
