import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import PatientLanguageBar from "../../components/PatientLanguageBar";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";

export default function PatientInsurance() {
  const navigate = useNavigate();
  const { t } = usePatientLanguage();
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [me, market] = await Promise.all([
        apiFetch("/api/profile"),
        apiFetch(`/api/hospitals/marketplace?q=${encodeURIComponent(q)}`),
      ]);
      setProfile(me || null);
      setHospitals(Array.isArray(market?.items) ? market.items : []);
    } catch {
      setProfile(null);
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>{t("insuranceTitle", "Insurance & Hospital Services")}</h2>
          <p className="muted">
            {t(
              "insuranceSubtitle",
              "View your insurance balance/profile and find hospitals with supported insurance and payment channels."
            )}
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/hospitals")}>
            {t("browseHospitals", "Browse Hospitals")}
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate("/patient/appointments")}>
            {t("bookAppointment", "Book Appointment")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/payments")}>
            {t("payBills", "Pay Bills")}
          </button>
        </div>
      </div>

      <PatientLanguageBar
        title={t("insuranceTitle", "Insurance & Hospital Services")}
        subtitle={t(
          "insuranceSubtitle",
          "View your insurance balance/profile and find hospitals with supported insurance and payment channels."
        )}
      />

      <section className="section">
        <h3>{t("myInsuranceProfile", "My Insurance Profile")}</h3>
        <div className="card premium-card">
          <div className="grid info-grid">
            <div>
              <strong>{t("provider", "Provider")}</strong>
              <p className="muted">
                {profile?.insuranceProfile?.providerName || profile?.insuranceProfile?.providerCode || "Not set"}
              </p>
            </div>
            <div>
              <strong>{t("memberNumber", "Member Number")}</strong>
              <p className="muted">{profile?.insuranceProfile?.memberNumber || "Not set"}</p>
            </div>
            <div>
              <strong>{t("balance", "Balance")}</strong>
              <p className="muted">
                {(profile?.insuranceProfile?.currency || "KES")} {Number(profile?.insuranceProfile?.balance || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <strong>{t("status", "Status")}</strong>
              <p className="muted">{profile?.insuranceProfile?.status || "PENDING"}</p>
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>
            {t("updateInsuranceProfile", "Update Insurance Profile")}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>{t("hospitalsOnAfyaLink", "Hospitals on AfyaLink")}</h3>
        <div className="card premium-card">
          <label>{t("searchHospital", "Search hospital")}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("hospitalSearchPlaceholder", "Hospital name, code or address")}
          />
          {loading ? (
            <p className="muted">{t("loadingHospitals", "Loading hospitals...")}</p>
          ) : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>{t("searchHospital", "Hospital")}</th>
                    <th>{t("insurance", "Insurance")}</th>
                    <th>{t("paymentChannels", "Payment Channels")}</th>
                    <th>{t("actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals.map((h) => (
                    <tr key={h._id}>
                      <td>
                        <strong>{h.name}</strong>
                        <div className="muted">{h.code || "—"} • {h.address || "No address"}</div>
                      </td>
                      <td>
                        {(h.insuranceProviders || []).length
                          ? h.insuranceProviders.map((p) => p.name || p.code).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        {(h.patientPaymentMethods || []).length
                          ? h.patientPaymentMethods.map((m) => m.label || m.type).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn-secondary" onClick={() => navigate(`/patient/appointments?hospitalId=${h._id}`)}>
                            {t("book", "Book")}
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => navigate(`/payments?hospitalId=${h._id}`)}>
                            {t("payBill", "Pay Bill")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {hospitals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">{t("noHospitalsFound", "No hospitals found.")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
