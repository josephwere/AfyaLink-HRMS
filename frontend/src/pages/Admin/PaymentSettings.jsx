import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import DismissibleCardSection from "../../components/DismissibleCardSection";
import PasswordInput from "../../components/PasswordInput";

export default function PaymentSettings() {
  const [meta, setMeta] = useState({});
  const [busy, setBusy] = useState(false);
  const [savingSection, setSavingSection] = useState("");
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState("edit");
  const [revealed, setRevealed] = useState(null);
  const [form, setForm] = useState({
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
  });

  const load = async () => {
    const js = await apiFetch("/api/payment-settings/get");
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
  };

  useEffect(() => {
    load();
  }, []);

  const buildPayload = () => ({
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
  });

  const save = async (sectionLabel = "all settings") => {
    if (!form.adminPassword || form.adminPassword.length < 8) {
      setMsg("Admin password is required (min 8 chars) to encrypt and save.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/api/payment-settings/save", {
        method: "POST",
        body: buildPayload(),
      });
      setMsg(`${sectionLabel} saved and encrypted.`);
      await load();
    } catch (e) {
      setMsg(e.message || "Failed to save payment settings");
    } finally {
      setBusy(false);
    }
  };

  const saveSection = async (section) => {
    setSavingSection(section);
    const labelMap = {
      mode: "Global mode and admin security",
      bank: "Bank payout details",
      card: "Card payout details",
      mpesa: "M-Pesa details",
      gateways: "Gateway keys",
    };
    await save(labelMap[section] || "Settings");
    setSavingSection("");
  };

  const requestOtp = async () => {
    setBusy(true);
    setMsg("");
    try {
      const js = await apiFetch("/api/payment-settings/reveal/request", { method: "POST" });
      if (js?.error) throw new Error(js?.error || "Failed to request OTP");
      setStep("otp_requested");
      setMsg(js.message || "OTP sent.");
    } catch (e) {
      setMsg(e.message || "Failed to request OTP");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setMsg("");
    try {
      const js = await apiFetch("/api/payment-settings/reveal/verify", {
        method: "POST",
        body: { code: form.otp, adminPassword: form.adminPassword },
      });
      if (js?.error) throw new Error(js?.error || "Failed to verify OTP");
      setRevealed(js?.secrets || {});
      setStep("edit");
      setMsg("Secrets revealed for this session.");
    } catch (e) {
      setMsg(e.message || "Failed to verify OTP");
    } finally {
      setBusy(false);
    }
  };

  const rotatePassword = async () => {
    const oldPassword = window.prompt("Enter OLD admin password");
    const newPassword = window.prompt("Enter NEW admin password");
    if (!oldPassword || !newPassword) return;
    setBusy(true);
    setMsg("");
    try {
      const js = await apiFetch("/api/payment-settings/rotate-password", {
        method: "POST",
        body: { oldPassword, newPassword },
      });
      if (js?.error) throw new Error(js?.error || "Failed to rotate password");
      setMsg("Encryption password rotated successfully.");
    } catch (e) {
      setMsg(e.message || "Failed to rotate password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Payment Settings</h2>
          <p className="muted">
            Manage founder payout details and gateway configuration from UI. Secrets are encrypted.
          </p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <div className="grid info-grid">
        <DismissibleCardSection className="card form" title="Global Mode & Admin Security">
          <label>Mode</label>
          <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>

          <PasswordInput
            label="Admin Encryption Password"
            value={form.adminPassword}
            autoComplete="current-password"
            helperText="Required to save or reveal encrypted secrets."
            onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
          />

          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={() => saveSection("mode")} disabled={busy}>
              {savingSection === "mode" ? "Saving..." : "Save Security Card"}
            </button>
            <button type="button" className="btn-secondary" onClick={requestOtp} disabled={busy}>Request OTP</button>
            <button type="button" className="btn-secondary" onClick={rotatePassword} disabled={busy}>Rotate Password</button>
          </div>

          {step === "otp_requested" && (
            <>
              <label>OTP Code</label>
              <input
                value={form.otp}
                onChange={(e) => setForm((f) => ({ ...f, otp: e.target.value }))}
                placeholder="Enter OTP sent to your phone/email"
              />
              <button type="button" className="btn-primary" onClick={verifyOtp} disabled={busy}>Verify & Reveal</button>
            </>
          )}
        </DismissibleCardSection>

        <DismissibleCardSection className="card form" title="Bank Payout Details">
          <label>Bank Name</label>
          <input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
          <label>Bank Branch</label>
          <input value={form.bankBranch} onChange={(e) => setForm((f) => ({ ...f, bankBranch: e.target.value }))} />
          <label>Account Name</label>
          <input value={form.bankAccountName} onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))} />
          <label>Account Number (encrypted)</label>
          <PasswordInput
            label=""
            value={form.bankAccountNumber}
            autoComplete="off"
            placeholder="Account number"
            onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
          />
          <label>SWIFT/BIC</label>
          <input value={form.bankSwiftCode} onChange={(e) => setForm((f) => ({ ...f, bankSwiftCode: e.target.value }))} />
          <p className="muted">Stored metadata: {meta?.bank?.bankName || "-"} • {meta?.bank?.accountName || "-"} • account encrypted: {meta?.bank?.hasAccountNumber ? "Yes" : "No"}</p>
          <button type="button" className="btn-primary" onClick={() => saveSection("bank")} disabled={busy}>
            {savingSection === "bank" ? "Saving..." : "Save Bank Card"}
          </button>
        </DismissibleCardSection>

        <DismissibleCardSection className="card form" title="Card Payout / Settlement">
          <label>Card Holder Name</label>
          <input value={form.cardHolderName} onChange={(e) => setForm((f) => ({ ...f, cardHolderName: e.target.value }))} />
          <label>Card Brand</label>
          <input value={form.cardBrand} onChange={(e) => setForm((f) => ({ ...f, cardBrand: e.target.value }))} placeholder="Visa, Mastercard..." />
          <label>Card Last 4</label>
          <input value={form.cardLast4} onChange={(e) => setForm((f) => ({ ...f, cardLast4: e.target.value }))} placeholder="1234" />
          <div className="profile-row">
            <div style={{ flex: 1 }}>
              <label>Expiry Month</label>
              <input value={form.cardExpiryMonth} onChange={(e) => setForm((f) => ({ ...f, cardExpiryMonth: e.target.value }))} placeholder="MM" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Expiry Year</label>
              <input value={form.cardExpiryYear} onChange={(e) => setForm((f) => ({ ...f, cardExpiryYear: e.target.value }))} placeholder="YYYY" />
            </div>
          </div>
          <label>Vault/Token Reference (encrypted)</label>
          <PasswordInput
            label=""
            value={form.cardVaultRef}
            autoComplete="off"
            placeholder="Use gateway token/reference, not CVV/full PAN"
            onChange={(e) => setForm((f) => ({ ...f, cardVaultRef: e.target.value }))}
          />
          <p className="muted">Stored metadata: {meta?.card?.brand || "-"} • ****{meta?.card?.last4 || "----"} • vault encrypted: {meta?.card?.hasVaultRef ? "Yes" : "No"}</p>
          <button type="button" className="btn-primary" onClick={() => saveSection("card")} disabled={busy}>
            {savingSection === "card" ? "Saving..." : "Save Card Payout Card"}
          </button>
        </DismissibleCardSection>

        <DismissibleCardSection className="card form" title="M-Pesa Details">
          <label>Consumer Key</label>
          <input value={form.mpesaConsumerKey} onChange={(e) => setForm((f) => ({ ...f, mpesaConsumerKey: e.target.value }))} />
          <label>Consumer Secret (encrypted)</label>
          <PasswordInput
            label=""
            value={form.mpesaConsumerSecret}
            autoComplete="off"
            placeholder="Consumer secret"
            onChange={(e) => setForm((f) => ({ ...f, mpesaConsumerSecret: e.target.value }))}
          />
          <label>Shortcode</label>
          <input value={form.mpesaShortcode} onChange={(e) => setForm((f) => ({ ...f, mpesaShortcode: e.target.value }))} />
          <label>Paybill Number</label>
          <input value={form.mpesaPaybill} onChange={(e) => setForm((f) => ({ ...f, mpesaPaybill: e.target.value }))} />
          <label>Till Number</label>
          <input value={form.mpesaTill} onChange={(e) => setForm((f) => ({ ...f, mpesaTill: e.target.value }))} />
          <label>Account Reference</label>
          <input value={form.mpesaAccountReference} onChange={(e) => setForm((f) => ({ ...f, mpesaAccountReference: e.target.value }))} />
          <label>Business Name</label>
          <input value={form.mpesaBusinessName} onChange={(e) => setForm((f) => ({ ...f, mpesaBusinessName: e.target.value }))} />
          <button type="button" className="btn-primary" onClick={() => saveSection("mpesa")} disabled={busy}>
            {savingSection === "mpesa" ? "Saving..." : "Save M-Pesa Card"}
          </button>
        </DismissibleCardSection>

        <DismissibleCardSection className="card form" title="Gateway Keys">
          <label>Stripe Publishable Key</label>
          <input value={form.stripePublishable} onChange={(e) => setForm((f) => ({ ...f, stripePublishable: e.target.value }))} />
          <label>Stripe Secret Key (encrypted)</label>
          <PasswordInput
            label=""
            value={form.stripeSecret}
            autoComplete="off"
            placeholder="Stripe secret key"
            onChange={(e) => setForm((f) => ({ ...f, stripeSecret: e.target.value }))}
          />
          <label>Flutterwave Secret (encrypted)</label>
          <PasswordInput
            label=""
            value={form.flutterSecret}
            autoComplete="off"
            placeholder="Flutterwave secret"
            onChange={(e) => setForm((f) => ({ ...f, flutterSecret: e.target.value }))}
          />
          <p className="muted">
            Stripe secret saved: {meta?.stripe?.hasSecret ? "Yes" : "No"} • M-Pesa secret saved: {meta?.mpesa?.hasSecret ? "Yes" : "No"} • Flutterwave secret saved: {meta?.flutterwave?.hasSecret ? "Yes" : "No"}
          </p>
          <button type="button" className="btn-primary" onClick={() => saveSection("gateways")} disabled={busy}>
            {savingSection === "gateways" ? "Saving..." : "Save Gateway Card"}
          </button>
        </DismissibleCardSection>

        {revealed && (
          <DismissibleCardSection className="card" title="Revealed Secrets (Session)">
            <pre>{JSON.stringify(revealed, null, 2)}</pre>
          </DismissibleCardSection>
        )}
      </div>
    </div>
  );
}
