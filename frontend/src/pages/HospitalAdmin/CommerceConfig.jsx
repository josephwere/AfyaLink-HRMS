import React from "react";
import EditableSection from "../../components/EditableSection";
import ContentSkeleton from "../../components/ContentSkeleton";
import { TableEmptyState } from "../../components/GuidedEmptyState";
import { useCommerceConfig } from "../../hooks/useCommerceConfig";

export default function CommerceConfig() {
  const {
    loading,
    saving,
    msg,
    insuranceProviders,
    paymentMethods,
    settingsSaved,
    settingsEditing,
    setSettingsEditing,
    save,
    addInsuranceProvider,
    addPaymentMethod,
    updateInsuranceProvider,
    updatePaymentMethod,
    removeInsuranceProvider,
    removePaymentMethod,
    openCustomization,
  } = useCommerceConfig();

  if (loading) {
    return (
      <div className="dashboard">
        <ContentSkeleton title="Loading billing settings" variant="table" rows={5} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Insurance & Payment Setup</h2>
          <p className="muted">Configure insurance services (e.g. SHA) and payment methods visible to patients.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => openCustomization()}>
            Open Branding & Customization
          </button>
        </div>
      </div>

      <EditableSection
        title="Billing Settings"
        eyebrow="Hospital Admin"
        description="Control insurance providers and payment methods shown to patients."
        saved={settingsSaved}
        editing={settingsEditing}
        saving={saving}
        onEdit={() => setSettingsEditing(true)}
        onSave={() => void save()}
        onCancel={() => setSettingsEditing(false)}
        saveLabel="Save Settings"
        message={msg}
        aside={<span className="action-pill">{settingsSaved && !settingsEditing ? "Locked" : "Editable"}</span>}
      >
        <section className="section">
          <h3>Insurance Providers</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Enabled</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insuranceProviders.map((row, idx) => (
                  <tr key={`ins-${idx}`}>
                    <td><input value={row.code || ""} onChange={(e) => updateInsuranceProvider(idx, { code: e.target.value.toUpperCase() })} /></td>
                    <td><input value={row.name || ""} onChange={(e) => updateInsuranceProvider(idx, { name: e.target.value })} /></td>
                    <td><input value={row.country || ""} onChange={(e) => updateInsuranceProvider(idx, { country: e.target.value.toUpperCase() })} /></td>
                    <td><input type="checkbox" checked={row.enabled !== false} onChange={(e) => updateInsuranceProvider(idx, { enabled: e.target.checked })} /></td>
                    <td><button type="button" className="btn-secondary" onClick={() => removeInsuranceProvider(idx)}>Remove</button></td>
                  </tr>
                ))}
                {insuranceProviders.length === 0 && (
                  <TableEmptyState
                    colSpan={5}
                    icon="INS"
                    title="No Insurance Providers Yet"
                    body="Add SHA, private insurers, or hospital-supported coverage options when ready."
                  />
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-secondary" onClick={() => addInsuranceProvider()}>Add Insurance Provider</button>
        </section>

        <section className="section">
          <h3>Patient Payment Methods</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Label</th>
                  <th>Paybill/Till/Account</th>
                  <th>Phone/Email</th>
                  <th>Enabled</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((row, idx) => (
                  <tr key={`pay-${idx}`}>
                    <td><input value={row.type || ""} onChange={(e) => updatePaymentMethod(idx, { type: e.target.value.toUpperCase() })} /></td>
                    <td><input value={row.label || ""} onChange={(e) => updatePaymentMethod(idx, { label: e.target.value })} /></td>
                    <td>
                      <input
                        value={row.paybill || row.tillNumber || row.accountNumber || ""}
                        onChange={(e) => updatePaymentMethod(idx, { accountNumber: e.target.value })}
                        placeholder="Paybill, till or account"
                      />
                    </td>
                    <td>
                      <input
                        value={row.phone || row.email || ""}
                        onChange={(e) => updatePaymentMethod(idx, { phone: e.target.value })}
                        placeholder="Phone or email"
                      />
                    </td>
                    <td><input type="checkbox" checked={row.enabled !== false} onChange={(e) => updatePaymentMethod(idx, { enabled: e.target.checked })} /></td>
                    <td><button type="button" className="btn-secondary" onClick={() => removePaymentMethod(idx)}>Remove</button></td>
                  </tr>
                ))}
                {paymentMethods.length === 0 && (
                  <TableEmptyState
                    colSpan={6}
                    icon="KES"
                    title="No Payment Methods Yet"
                    body="Add M-Pesa, bank, card, or invoice instructions before patients pay online."
                  />
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-secondary" onClick={() => addPaymentMethod()}>Add Payment Method</button>
        </section>
      </EditableSection>
    </div>
  );
}
