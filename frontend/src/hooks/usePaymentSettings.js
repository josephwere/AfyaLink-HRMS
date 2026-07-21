import { useCallback, useEffect, useState } from "react";
import {
  getPaymentSettings,
  requestPaymentSettingsOtp,
  rotatePaymentSettingsPassword,
  savePaymentSettings,
  verifyPaymentSettingsOtp,
} from "../services/paymentSettingsApi";

const PAYMENT_SECTION_KEYS = ["mode", "bank", "card", "mpesa", "gateways"];

function paymentSectionState(value) {
  return PAYMENT_SECTION_KEYS.reduce((acc, key) => ({ ...acc, [key]: value }), {});
}

const INITIAL_FORM = {
  mode: "test",
  adminPassword: "",
  otp: "",
  stripePublishable: "",
  stripeSecret: "",
  mpesaConsumerKey: "",
  mpesaConsumerSecret: "",
  mpesaShortcode: "",
  mpesaPaybill: "",
  mpesaTill: "",
  mpesaAccountReference: "",
  mpesaBusinessName: "",
  flutterSecret: "",
  bankName: "",
  bankBranch: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankSwiftCode: "",
  cardHolderName: "",
  cardBrand: "",
  cardLast4: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  cardVaultRef: "",
};

export function usePaymentSettings() {
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingSection, setSavingSection] = useState("");
  const [msg, setMsg] = useState("");
  const [sectionSaved, setSectionSaved] = useState(paymentSectionState(false));
  const [sectionEditing, setSectionEditing] = useState(paymentSectionState(true));
  const [step, setStep] = useState("edit");
  const [revealed, setRevealed] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const js = await getPaymentSettings();
      setMeta(js || {});
      setForm((prev) => ({
        ...prev,
        mode: js?.mode || "test",
        stripePublishable: js?.stripe?.publishable || "",
        mpesaShortcode: js?.mpesa?.shortcode || "",
        mpesaPaybill: js?.mpesa?.paybillNumber || "",
        mpesaTill: js?.mpesa?.tillNumber || "",
        mpesaAccountReference: js?.mpesa?.accountReference || "",
        mpesaBusinessName: js?.mpesa?.businessName || "",
        bankName: js?.bank?.bankName || "",
        bankBranch: js?.bank?.branch || "",
        bankAccountName: js?.bank?.accountName || "",
        bankSwiftCode: js?.bank?.swiftCode || "",
        cardHolderName: js?.card?.holderName || "",
        cardBrand: js?.card?.brand || "",
        cardLast4: js?.card?.last4 || "",
        cardExpiryMonth: js?.card?.expiryMonth || "",
        cardExpiryYear: js?.card?.expiryYear || "",
      }));
      setSectionSaved(paymentSectionState(true));
      setSectionEditing(paymentSectionState(false));
    } catch (e) {
      setMsg(e?.message || "Failed to load payment settings.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buildPayload = useCallback(() => ({
    mode: form.mode,
    adminPassword: form.adminPassword,
    stripe: {
      publishable: form.stripePublishable,
      secret: form.stripeSecret,
    },
    mpesa: {
      consumerKey: form.mpesaConsumerKey,
      consumerSecret: form.mpesaConsumerSecret,
      shortcode: form.mpesaShortcode,
      paybillNumber: form.mpesaPaybill,
      tillNumber: form.mpesaTill,
      accountReference: form.mpesaAccountReference,
      businessName: form.mpesaBusinessName,
    },
    flutterwave: {
      secret: form.flutterSecret,
    },
    bank: {
      bankName: form.bankName,
      branch: form.bankBranch,
      accountName: form.bankAccountName,
      accountNumber: form.bankAccountNumber,
      swiftCode: form.bankSwiftCode,
    },
    card: {
      holderName: form.cardHolderName,
      brand: form.cardBrand,
      last4: form.cardLast4,
      expiryMonth: form.cardExpiryMonth,
      expiryYear: form.cardExpiryYear,
      vaultRef: form.cardVaultRef,
    },
  }), [form]);

  const save = useCallback(async (sectionLabel = "all settings") => {
    if (!form.adminPassword || form.adminPassword.length < 8) {
      setMsg("Admin password is required (min 8 chars) to encrypt and save.");
      return false;
    }
    setBusy(true);
    setMsg("");
    try {
      await savePaymentSettings(buildPayload());
      await load({ silent: true });
      return true;
    } catch (e) {
      setMsg(e.message || "Failed to save payment settings");
      return false;
    } finally {
      setBusy(false);
    }
  }, [buildPayload, form.adminPassword, load]);

  const saveSection = useCallback(async (section) => {
    setSavingSection(section);
    const labelMap = {
      mode: "Global mode and admin security",
      bank: "Bank payout details",
      card: "Card payout details",
      mpesa: "M-Pesa details",
      gateways: "Gateway keys",
    };
    const didSave = await save(labelMap[section] || "Settings");
    if (didSave) {
      setSectionSaved((prev) => ({ ...prev, [section]: true }));
      setSectionEditing((prev) => ({ ...prev, [section]: false }));
    }
    setSavingSection("");
    return didSave;
  }, [save]);

  const editSection = useCallback((section) => {
    setSectionEditing((prev) => ({ ...prev, [section]: true }));
  }, []);

  const cancelSection = useCallback((section) => {
    setSectionEditing((prev) => ({ ...prev, [section]: false }));
  }, []);

  const requestOtp = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const js = await requestPaymentSettingsOtp();
      if (js?.error) throw new Error(js?.error || "Failed to request OTP");
      setStep("otp_requested");
      return true;
    } catch (e) {
      setMsg(e.message || "Failed to request OTP");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const verifyOtp = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const js = await verifyPaymentSettingsOtp({ code: form.otp, adminPassword: form.adminPassword });
      if (js?.error) throw new Error(js?.error || "Failed to verify OTP");
      setRevealed(js?.secrets || {});
      setStep("edit");
      return true;
    } catch (e) {
      setMsg(e.message || "Failed to verify OTP");
      return false;
    } finally {
      setBusy(false);
    }
  }, [form.adminPassword, form.otp]);

  const rotatePassword = useCallback(async () => {
    const oldPassword = window.prompt("Enter OLD admin password");
    const newPassword = window.prompt("Enter NEW admin password");
    if (!oldPassword || !newPassword) return false;
    setBusy(true);
    setMsg("");
    try {
      const js = await rotatePaymentSettingsPassword({ oldPassword, newPassword });
      if (js?.error) throw new Error(js?.error || "Failed to rotate password");
      return true;
    } catch (e) {
      setMsg(e.message || "Failed to rotate password");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    meta,
    loading,
    busy,
    savingSection,
    msg,
    setMsg,
    sectionSaved,
    setSectionSaved,
    sectionEditing,
    setSectionEditing,
    step,
    setStep,
    revealed,
    setRevealed,
    form,
    setForm,
    load,
    save,
    saveSection,
    editSection,
    cancelSection,
    requestOtp,
    verifyOtp,
    rotatePassword,
  };
}

export default usePaymentSettings;
