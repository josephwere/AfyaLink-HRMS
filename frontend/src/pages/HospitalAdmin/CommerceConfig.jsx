import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { useNavigate } from "react-router-dom";

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

export default function CommerceConfig() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [insuranceProviders, setInsuranceProviders] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/hospital-admin/config");
      setInsuranceProviders(Array.isArray(data?.insuranceProviders) ? data.insuranceProviders : []);
      setPaymentMethods(Array.isArray(data?.patientPaymentMethods) ? data.patientPaymentMethods : []);
    } catch {
      setInsuranceProviders([]);
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/hospital-admin/commerce-config", {
        method: "PUT",
        body: { insuranceProviders, patientPaymentMethods: paymentMethods },
      });
      setMsg("Hospital insurance and payment settings saved.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Insurance & Payment Setup</h2>
          <p className="muted">Configure insurance services (e.g. SHA) and payment methods visible to patients.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/customization")}>
            Open Branding & Customization
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Insurance Providers</h3>
        <div className="card premium-card">
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
                    <td><input value={row.code || ""} onChange={(e) => setInsuranceProviders((prev) => prev.map((r,i)=> i===idx ? { ...r, code: e.target.value.toUpperCase() } : r))} /></td>
                    <td><input value={row.name || ""} onChange={(e) => setInsuranceProviders((prev) => prev.map((r,i)=> i===idx ? { ...r, name: e.target.value } : r))} /></td>
                    <td><input value={row.country || ""} onChange={(e) => setInsuranceProviders((prev) => prev.map((r,i)=> i===idx ? { ...r, country: e.target.value.toUpperCase() } : r))} /></td>
                    <td><input type="checkbox" checked={row.enabled !== false} onChange={(e) => setInsuranceProviders((prev) => prev.map((r,i)=> i===idx ? { ...r, enabled: e.target.checked } : r))} /></td>
                    <td><button type="button" className="btn-secondary" onClick={() => setInsuranceProviders((prev) => prev.filter((_,i) => i !== idx))}>Remove</button></td>
                  </tr>
                ))}
                {insuranceProviders.length === 0 && (
                  <tr><td colSpan={5} className="muted">No providers added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setInsuranceProviders((prev) => [...prev, emptyInsurance()])}>Add Insurance Provider</button>
        </div>
      </section>

      <section className="section">
        <h3>Patient Payment Methods</h3>
        <div className="card premium-card">
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
                    <td><input value={row.type || ""} onChange={(e) => setPaymentMethods((prev) => prev.map((r,i)=> i===idx ? { ...r, type: e.target.value.toUpperCase() } : r))} /></td>
                    <td><input value={row.label || ""} onChange={(e) => setPaymentMethods((prev) => prev.map((r,i)=> i===idx ? { ...r, label: e.target.value } : r))} /></td>
                    <td>
                      <input
                        value={row.paybill || row.tillNumber || row.accountNumber || ""}
                        onChange={(e) => setPaymentMethods((prev) => prev.map((r,i)=> i===idx ? { ...r, accountNumber: e.target.value } : r))}
                        placeholder="Paybill, till or account"
                      />
                    </td>
                    <td>
                      <input
                        value={row.phone || row.email || ""}
                        onChange={(e) => setPaymentMethods((prev) => prev.map((r,i)=> i===idx ? { ...r, phone: e.target.value } : r))}
                        placeholder="Phone or email"
                      />
                    </td>
                    <td><input type="checkbox" checked={row.enabled !== false} onChange={(e) => setPaymentMethods((prev) => prev.map((r,i)=> i===idx ? { ...r, enabled: e.target.checked } : r))} /></td>
                    <td><button type="button" className="btn-secondary" onClick={() => setPaymentMethods((prev) => prev.filter((_,i) => i !== idx))}>Remove</button></td>
                  </tr>
                ))}
                {paymentMethods.length === 0 && (
                  <tr><td colSpan={6} className="muted">No payment methods added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setPaymentMethods((prev) => [...prev, emptyPayment()])}>Add Payment Method</button>
        </div>
      </section>

      <section className="section">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </section>
    </div>
  );
}
