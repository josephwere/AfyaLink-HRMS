import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showActionSuccessGuide } from "../components/ActionSuccessGuide";
import { getHospitalAdminConfig, saveHospitalCommerceConfig } from "../services/hospitalAdminConfigApi";

function emptyInsurance() {
  return { code: "", name: "", country: "", enabled: true };
}

function emptyPayment() {
  return {
    type: "",
    label: "",
    accountName: "",
    accountNumber: "",
    paybill: "",
    tillNumber: "",
    phone: "",
    email: "",
    instructions: "",
    enabled: true,
  };
}

export function useCommerceConfig() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [insuranceProviders, setInsuranceProviders] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsEditing, setSettingsEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHospitalAdminConfig();
      setInsuranceProviders(Array.isArray(data?.insuranceProviders) ? data.insuranceProviders : []);
      setPaymentMethods(Array.isArray(data?.patientPaymentMethods) ? data.patientPaymentMethods : []);
      setSettingsSaved(true);
      setSettingsEditing(false);
    } catch (err) {
      setInsuranceProviders([]);
      setPaymentMethods([]);
      setSettingsSaved(false);
      setSettingsEditing(true);
      setMsg(err?.message || "Could not load billing settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setMsg("");
    try {
      await saveHospitalCommerceConfig({ insuranceProviders, patientPaymentMethods: paymentMethods });
      setMsg("Hospital insurance and payment settings saved.");
      setSettingsSaved(true);
      setSettingsEditing(false);
      showActionSuccessGuide({
        title: "Billing Settings Saved",
        message: "Patient insurance and payment options have been updated for this hospital.",
        icon: "KES",
        nextActions: [
          { label: "Open Branding", path: "/hospital-admin/customization", variant: "secondary" },
          {
            label: "Ask AI",
            action: "ai",
            aiPrompt: "Review these hospital billing settings and suggest what should be checked before patients use online payments.",
            variant: "secondary",
          },
        ],
        notificationCategory: "ACCOUNT",
      });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [insuranceProviders, load, paymentMethods]);

  const addInsuranceProvider = useCallback(() => {
    setInsuranceProviders((prev) => [...prev, emptyInsurance()]);
  }, []);

  const addPaymentMethod = useCallback(() => {
    setPaymentMethods((prev) => [...prev, emptyPayment()]);
  }, []);

  const updateInsuranceProvider = useCallback((index, patch) => {
    setInsuranceProviders((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }, []);

  const updatePaymentMethod = useCallback((index, patch) => {
    setPaymentMethods((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }, []);

  const removeInsuranceProvider = useCallback((index) => {
    setInsuranceProviders((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const removePaymentMethod = useCallback((index) => {
    setPaymentMethods((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const openCustomization = useCallback(() => {
    navigate("/hospital-admin/customization");
  }, [navigate]);

  const emptyRows = useMemo(() => ({ insurance: emptyInsurance(), payment: emptyPayment() }), []);

  return {
    loading,
    saving,
    msg,
    insuranceProviders,
    paymentMethods,
    settingsSaved,
    settingsEditing,
    setSettingsEditing,
    load,
    save,
    addInsuranceProvider,
    addPaymentMethod,
    updateInsuranceProvider,
    updatePaymentMethod,
    removeInsuranceProvider,
    removePaymentMethod,
    openCustomization,
    emptyRows,
  };
}

export default useCommerceConfig;
