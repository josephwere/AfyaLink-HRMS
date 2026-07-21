import React from "react";
import AIAutofillAuditSummary from "../../components/AIAutofillAuditSummary";
import useHospitalAdminPharmacyReferrals from "../../hooks/useHospitalAdminPharmacyReferrals";

export default function HospitalAdminPharmacyReferrals() {
  const {
    lat,
    setLat,
    lng,
    setLng,
    radiusKm,
    setRadiusKm,
    q,
    setQ,
    pharmacies,
    referrals,
    selectedPharmacyId,
    setSelectedPharmacyId,
    loading,
    saving,
    msg,
    setMsg,
    locating,
    form,
    setForm,
    locationReady,
    selectedPharmacy,
    loadNearbyPharmacies,
    loadExistingReferrals,
    useCurrentLocation,
    submitReferral,
  } = useHospitalAdminPharmacyReferrals();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Pharmacy Referrals</h2>
          <p className="muted">Find nearest registered pharmacies and refer patients when medicine is unavailable in hospital stock.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <AIAutofillAuditSummary
        title="Referral Autofill Review"
        subtitle="Recent AI draft/apply activity for pharmacy referrals and transfer handovers in this hospital."
        templateIds={["referrals", "admissions"]}
        routeIncludes={["/hospital-admin/pharmacy-referrals", "/hospital-admin/transfer-command-center"]}
      />

      <section className="section">
        <div className="card premium-card">
          <h3>1) Choose Location</h3>
          <label>Latitude</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="-1.286389"
            data-ai-label="Latitude"
            data-ai-aliases="referral latitude|current latitude"
            data-ai-intent="location-filter"
            data-ai-priority="low"
          />

          <label>Longitude</label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="36.817223"
            data-ai-label="Longitude"
            data-ai-aliases="referral longitude|current longitude"
            data-ai-intent="location-filter"
            data-ai-priority="low"
          />

          <label>Radius (km)</label>
          <input
            type="number"
            min={1}
            max={300}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value || 25))}
            data-ai-label="Radius (km)"
            data-ai-aliases="search radius|distance radius"
            data-ai-intent="location-filter"
            data-ai-priority="low"
          />

          <button type="button" className="btn-secondary" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Detecting..." : "Use Current Location"}
          </button>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>2) Select Nearby Pharmacy</h3>
          <label>Search pharmacy</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, license, region, city"
            data-ai-label="Search Pharmacy"
            data-ai-aliases="pharmacy search|find pharmacy|lookup pharmacy"
            data-ai-intent="lookup"
            data-ai-priority="low"
          />

          <label>Nearest pharmacies</label>
          <select
            value={selectedPharmacyId}
            onChange={(e) => setSelectedPharmacyId(e.target.value)}
            disabled={!locationReady || loading}
            data-ai-label="Destination Pharmacy"
            data-ai-aliases="selected pharmacy|receiving pharmacy|referral destination|dispensing pharmacy"
            data-ai-widget="pharmacy-directory-picker"
          >
            <option value="">{locationReady ? "Select pharmacy" : "Enter location first"}</option>
            {pharmacies.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} {Number.isFinite(Number(p.distanceKm)) ? `• ${Number(p.distanceKm).toFixed(1)} km` : ""}
              </option>
            ))}
          </select>

          {selectedPharmacy && (
            <p className="muted" style={{ marginTop: 8 }}>
              {selectedPharmacy.name} • {selectedPharmacy.licenseNumber} • {selectedPharmacy?.location?.region || ""}
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <form className="card premium-card" onSubmit={submitReferral}>
          <h3>3) Refer Patient</h3>
          <label>Patient name</label>
          <input
            value={form.patientName}
            onChange={(e) => setForm((p) => ({ ...p, patientName: e.target.value }))}
            required
            data-ai-label="Patient Name"
            data-ai-aliases="referral patient|patient full name"
          />

          <label>Patient phone</label>
          <input
            value={form.patientPhone}
            onChange={(e) => setForm((p) => ({ ...p, patientPhone: e.target.value }))}
            data-ai-label="Patient Phone"
            data-ai-aliases="patient contact|patient mobile|phone number"
          />

          <label>Referral reason</label>
          <input
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Medication unavailable in hospital"
            data-ai-label="Referral Reason"
            data-ai-aliases="handover reason|transfer reason|clinical reason"
          />

          <label>Medication / notes</label>
          <textarea
            rows={4}
            value={form.medicationNotes}
            onChange={(e) => setForm((p) => ({ ...p, medicationNotes: e.target.value }))}
            data-ai-label="Medication Notes"
            data-ai-aliases="drug notes|prescription notes|medication summary"
          />

          <label className="remember">
            <input
              type="checkbox"
              checked={form.urgent}
              onChange={(e) => setForm((p) => ({ ...p, urgent: e.target.checked }))}
              data-ai-label="Urgent Referral"
              data-ai-aliases="urgent|priority referral|stat referral"
            />
            Mark as urgent
          </label>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Creating..." : "Create Referral"}
          </button>
        </form>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Recent Referrals</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Pharmacy</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((row) => (
                  <tr key={row._id}>
                    <td>
                      {row.patientName}
                      <div className="muted">{row.patientPhone || "—"}</div>
                    </td>
                    <td>{row?.pharmacy?.name || "—"}</td>
                    <td>{row.status}</td>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {referrals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No referrals</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
