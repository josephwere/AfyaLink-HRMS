import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";

const emptyApplicationForm = {
  fullName: "",
  email: "",
  phone: "",
  coverLetter: "",
  resumeUrl: "",
  experienceSummary: "",
};

export default function PatientAdsFeed() {
  const [q, setQ] = useState("");
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [applyingId, setApplyingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyApplicationForm);

  const loadAds = async () => {
    setLoading(true);
    try {
      const [adsData, appData] = await Promise.all([
        apiFetch(`/api/recruitment-ads?q=${encodeURIComponent(q)}&limit=100`),
        apiFetch(`/api/recruitment-ads/applications?mine=1&limit=200`),
      ]);
      setAds(Array.isArray(adsData?.items) ? adsData.items : []);
      setApplications(Array.isArray(appData?.items) ? appData.items : []);
    } catch {
      setAds([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAds();
  }, [q]);

  const appByAdId = useMemo(() => {
    const map = new Map();
    applications.forEach((a) => {
      const adId = String(a?.ad?._id || a?.ad || "");
      if (adId) map.set(adId, a);
    });
    return map;
  }, [applications]);

  const startApply = (adId) => {
    setApplyingId(adId);
    setMsg("");
  };

  const cancelApply = () => {
    setApplyingId("");
    setForm(emptyApplicationForm);
  };

  const submitApplication = async (adId) => {
    setSubmitting(true);
    setMsg("");
    try {
      await apiFetch(`/api/recruitment-ads/${adId}/apply`, {
        method: "POST",
        body: form,
      });
      setMsg("Application submitted.");
      cancelApply();
      await loadAds();
    } catch (e) {
      setMsg(e?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Career & Vacancy Feed</h2>
          <p className="muted">View open hospital vacancies and apply directly inside AfyaLink.</p>
        </div>
      </div>

      <section className="section">
        <div className="card premium-card">
          {msg ? <div className="subtle-banner">{msg}</div> : null}

          <label>Search vacancies</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, department or location"
          />

          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Vacancy</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Application Status</th>
                    <th>Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => {
                    const existing = appByAdId.get(String(ad._id));
                    const showApply = String(applyingId) === String(ad._id);

                    return (
                      <React.Fragment key={ad._id}>
                        <tr>
                          <td>{ad?.hospital?.name || "Hospital"}</td>
                          <td>
                            <strong>{ad.title}</strong>
                            <div className="muted">{ad.role || "Role not specified"}</div>
                          </td>
                          <td>{ad.department || "—"}</td>
                          <td>{ad.location || "—"}</td>
                          <td>{existing?.status || "OPEN"}</td>
                          <td>
                            {existing ? (
                              <span className="muted">Already applied</span>
                            ) : (
                              <div className="row-actions">
                                <button className="btn-secondary" onClick={() => startApply(ad._id)}>
                                  Apply in AfyaLink
                                </button>
                                {ad.applyUrl ? (
                                  <a className="action-link" href={ad.applyUrl} target="_blank" rel="noreferrer">
                                    External Apply
                                  </a>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>

                        {showApply && (
                          <tr>
                            <td colSpan={6}>
                              <div className="card" style={{ margin: 0 }}>
                                <h4 style={{ marginTop: 0 }}>Apply: {ad.title}</h4>
                                <label>Full Name</label>
                                <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
                                <label>Email</label>
                                <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                                <label>Phone</label>
                                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                                <label>Resume URL (optional)</label>
                                <input value={form.resumeUrl} onChange={(e) => setForm((p) => ({ ...p, resumeUrl: e.target.value }))} />
                                <label>Experience Summary</label>
                                <textarea value={form.experienceSummary} onChange={(e) => setForm((p) => ({ ...p, experienceSummary: e.target.value }))} />
                                <label>Cover Letter</label>
                                <textarea value={form.coverLetter} onChange={(e) => setForm((p) => ({ ...p, coverLetter: e.target.value }))} />
                                <div className="row-actions">
                                  <button className="btn-primary" disabled={submitting} onClick={() => submitApplication(ad._id)}>
                                    {submitting ? "Submitting..." : "Submit Application"}
                                  </button>
                                  <button className="btn-secondary" disabled={submitting} onClick={cancelApply}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {ads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">No vacancies available right now.</td>
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
