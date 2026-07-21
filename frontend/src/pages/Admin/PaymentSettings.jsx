import React from "react";
import EditableSection from "../../components/EditableSection";
import ContentSkeleton from "../../components/ContentSkeleton";
import { showActionSuccessGuide } from "../../components/ActionSuccessGuide";
import PasswordInput from "../../components/PasswordInput";
import { usePaymentSettings } from "../../hooks/usePaymentSettings";

export default function PaymentSettings() {
  const {
    meta,
    loading,
    busy,
    savingSection,
    msg,
    sectionSaved,
    sectionEditing,
    step,
    revealed,
    form,
    setForm,
    saveSection,
    editSection,
    cancelSection,
    requestOtp,
    verifyOtp,
    rotatePassword,
  } = usePaymentSettings();

  const handleSaveSection = async (section) => {
    const labelMap = {
      mode: "Global mode and admin security",
      bank: "Bank payout details",
      card: "Card payout details",
      mpesa: "M-Pesa details",
      gateways: "Gateway keys",
    };
    const didSave = await saveSection(section);
    if (didSave) {
      showActionSuccessGuide({
        title: `${labelMap[section] || "Settings"} Saved`,
        message: "Payment configuration was encrypted and saved successfully.",
        icon: "✓",
        notificationTitle: "Payment settings saved",
        notificationBody: `${labelMap[section] || "Settings"} were encrypted and updated.`,
        notificationCategory: "ACCOUNT",
        aiRecommendation: "Ask AI to review payout and gateway readiness before switching to live mode.",
        nextActions: [
          {
            label: "Review With AI",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Review this AfyaLink payment configuration for launch readiness, without exposing any secrets.",
          },
        ],
      });
    }
  };

  const handleRequestOtp = async () => {
    const didRequest = await requestOtp();
    if (didRequest) {
      showActionSuccessGuide({
        title: "OTP Sent",
        message: "A verification code was sent for this secure payment settings action.",
        icon: "✓",
        notificationTitle: "Payment settings OTP sent",
        notificationBody: "A verification code was sent for revealing encrypted settings.",
        notificationCategory: "ACCOUNT",
        aiRecommendation: "Keep OTPs private and reveal secrets only from a trusted device.",
        nextActions: [
          {
            label: "Ask AI About Secure Handling",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Explain safe operational handling for OTP-protected payment settings without exposing secrets.",
          },
        ],
      });
    }
  };

  const handleVerifyOtp = async () => {
    const didVerify = await verifyOtp();
    if (didVerify) {
      showActionSuccessGuide({
        title: "Secrets Revealed For This Session",
        message: "Encrypted payment settings are available temporarily. Review them carefully and close the session when done.",
        icon: "✓",
        notificationTitle: "Payment secrets revealed",
        notificationBody: "Encrypted payment settings were revealed for the current session.",
        notificationCategory: "ACCOUNT",
        aiRecommendation: "Ask AI for a safe rotation and audit checklist after reviewing payment secrets.",
        nextActions: [
          {
            label: "Create Security Checklist",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Create a secure checklist for reviewing, rotating, and auditing payment gateway secrets.",
          },
        ],
      });
    }
  };

  const handleRotatePassword = async () => {
    const didRotate = await rotatePassword();
    if (didRotate) {
      showActionSuccessGuide({
        title: "Encryption Password Rotated",
        message: "Payment settings encryption has been rotated successfully.",
        icon: "✓",
        notificationTitle: "Payment encryption rotated",
        notificationBody: "The payment settings encryption password was rotated.",
        notificationCategory: "ACCOUNT",
        aiRecommendation: "Ask AI to generate a post-rotation audit checklist for payment operations.",
        nextActions: [
          {
            label: "Generate Audit Checklist",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Generate a post-rotation audit checklist for encrypted payment settings.",
          },
        ],
      });
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <ContentSkeleton title="Loading payment settings" variant="cards" cards={5} />
      </div>
    );
  }

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

      {msg && <div className="card status-card error">{msg}</div>}

      <div className="grid info-grid">
        <EditableSection
          title="Global Mode & Admin Security"
          description="Set the payment environment and confirm secure admin access before revealing or saving secrets."
          saved={sectionSaved.mode}
          editing={sectionEditing.mode}
          saving={busy && savingSection === "mode"}
          saveLabel="Save Security Settings"
          onEdit={() => editSection("mode")}
          onCancel={() => cancelSection("mode")}
          onSave={() => handleSaveSection("mode")}
        >
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
            <button type="button" className="btn-secondary" onClick={handleRequestOtp} disabled={busy}>Request OTP</button>
            <button type="button" className="btn-secondary" onClick={handleRotatePassword} disabled={busy}>Rotate Password</button>
          </div>

          {step === "otp_requested" && (
            <>
              <label>OTP Code</label>
              <input
                value={form.otp}
                onChange={(e) => setForm((f) => ({ ...f, otp: e.target.value }))}
                placeholder="Enter OTP sent to your phone/email"
              />
              <button type="button" className="btn-primary" onClick={handleVerifyOtp} disabled={busy}>Verify & Reveal</button>
            </>
          )}
        </EditableSection>

        <EditableSection
          title="Bank Payout Details"
          description="Maintain encrypted bank payout metadata for founder settlements."
          saved={sectionSaved.bank}
          editing={sectionEditing.bank}
          saving={busy && savingSection === "bank"}
          saveLabel="Save Bank Details"
          onEdit={() => editSection("bank")}
          onCancel={() => cancelSection("bank")}
          onSave={() => handleSaveSection("bank")}
        >
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
        </EditableSection>

        <EditableSection
          title="Card Payout / Settlement"
          description="Store settlement card metadata and encrypted vault references only."
          saved={sectionSaved.card}
          editing={sectionEditing.card}
          saving={busy && savingSection === "card"}
          saveLabel="Save Card Details"
          onEdit={() => editSection("card")}
          onCancel={() => cancelSection("card")}
          onSave={() => handleSaveSection("card")}
        >
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
        </EditableSection>

        <EditableSection
          title="M-Pesa Details"
          description="Configure M-Pesa business metadata and encrypted API credentials."
          saved={sectionSaved.mpesa}
          editing={sectionEditing.mpesa}
          saving={busy && savingSection === "mpesa"}
          saveLabel="Save M-Pesa Details"
          onEdit={() => editSection("mpesa")}
          onCancel={() => cancelSection("mpesa")}
          onSave={() => handleSaveSection("mpesa")}
        >
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
        </EditableSection>

        <EditableSection
          title="Gateway Keys"
          description="Manage encrypted Stripe and Flutterwave secrets without exposing raw values in the UI."
          saved={sectionSaved.gateways}
          editing={sectionEditing.gateways}
          saving={busy && savingSection === "gateways"}
          saveLabel="Save Gateway Keys"
          onEdit={() => editSection("gateways")}
          onCancel={() => cancelSection("gateways")}
          onSave={() => handleSaveSection("gateways")}
        >
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
        </EditableSection>

        {revealed && (
          <section className="card profile-card">
            <div className="card-header-actions">
              <div>
                <h3>Revealed Secrets (Session)</h3>
                <p className="muted">Temporary view for verified admins. Do not leave this screen unattended.</p>
              </div>
            </div>
            <pre>{JSON.stringify(revealed, null, 2)}</pre>
          </section>
        )}
      </div>
    </div>
  );
}
