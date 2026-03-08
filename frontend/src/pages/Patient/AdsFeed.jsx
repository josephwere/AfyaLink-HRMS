import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  applyToRecruitmentAd,
  listRecruitmentAds,
  listRecruitmentApplications,
  trackRecruitmentAdEvent,
} from "../../services/recruitmentAdsApi";

const emptyApplicationForm = {
  fullName: "",
  email: "",
  phone: "",
  coverLetter: "",
  resumeUrl: "",
  experienceSummary: "",
  privateAccessToken: "",
};

function buildApplicationPayload(form, resumeFile) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      data.append(key, value);
    }
  });
  if (resumeFile) data.append("resumeFile", resumeFile);
  return data;
}

export default function PatientAdsFeed({ variant = "app", defaultSource = "PATIENT_FEED" }) {
  const location = useLocation();
  const [q, setQ] = useState("");
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [applyingId, setApplyingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [form, setForm] = useState(emptyApplicationForm);
  const source = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get("src") || defaultSource || "PATIENT_FEED").trim().toUpperCase();
  }, [defaultSource, location.search]);

  const loadAds = async () => {
    setLoading(true);
    try {
      const [adsData, appData] = await Promise.all([
        listRecruitmentAds({ q, limit: 100, source }),
        listRecruitmentApplications({ mine: 1, limit: 200 }),
      ]);
      setAds(Array.isArray(adsData?.items) ? adsData.items : []);
      setApplications(Array.isArray(appData?.items) ? appData.items : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load vacancies");
      setAds([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAds();
  }, [q, source]);

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
    setResumeFile(null);
    setMsg("");
    trackRecruitmentAdEvent(adId, { event: "APPLY_INTENT", source }).catch(() => {});
  };

  const cancelApply = () => {
    setApplyingId("");
    setResumeFile(null);
    setForm(emptyApplicationForm);
  };

  const submitApplication = async (adId) => {
    setSubmitting(true);
    setMsg("");
    try {
      const payload = buildApplicationPayload({ ...form, source }, resumeFile);
      await applyToRecruitmentAd(adId, payload);
      setMsg("Application submitted.");
      cancelApply();
      await loadAds();
    } catch (e) {
      setMsg(e?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const trackAndFollow = (adId, event) => () => {
    trackRecruitmentAdEvent(adId, { event, source }).catch(() => {});
  };

  if (variant === "public") {
    return (
      <div className="dashboard">
        <div className="welcome-panel recruitment-public-hero">
          <div>
            <span className="pill">AfyaLink Careers</span>
            <h1 style={{ marginBottom: 10 }}>Work with verified hospitals across AfyaLink.</h1>
            <p className="muted" style={{ maxWidth: 760 }}>
              Browse healthcare opportunities from government-verified hospitals, compare benefits and work modes,
              then apply with your profile and resume inside one secure flow.
            </p>
            <div className="welcome-actions" style={{ marginTop: 12 }}>
              <a className="btn-primary" href="#careers-feed">Browse openings</a>
              <Link className="btn-secondary" to="/register">Create candidate account</Link>
              <Link className="btn-secondary" to="/login">Sign in</Link>
            </div>
          </div>
          <div className="card premium-card">
            <h3 style={{ marginTop: 0 }}>Why hospitals post here</h3>
            <ul style={{ margin: 0 }}>
              <li>Verified hospital recruitment only</li>
              <li>Rich banners, brochures, videos, and campaigns</li>
              <li>Structured applicant pipeline with resume review</li>
              <li>Source-aware analytics for every campaign</li>
            </ul>
          </div>
        </div>

        <section className="section">
          <div className="grid info-grid">
            <div className="card premium-card">
              <h3>Verified Employers</h3>
              <p className="muted">Only approved AfyaLink hospitals can publish public campaigns.</p>
            </div>
            <div className="card premium-card">
              <h3>Faster Discovery</h3>
              <p className="muted">Search by role, department, location, benefit, or campaign summary.</p>
            </div>
            <div className="card premium-card">
              <h3>One Candidate Flow</h3>
              <p className="muted">Upload resume, track applications, and move from discovery to hiring in one place.</p>
            </div>
          </div>
        </section>

        <div id="careers-feed">
          {renderFeed()}
        </div>
      </div>
    );
  }

  return renderFeed();

  function renderFeed() {
    return (
      <div className="dashboard">
        <div className="welcome-panel">
          <div>
            <h2>Career & Vacancy Feed</h2>
            <p className="muted">
              View premium hospital vacancies, see campaign banners and benefits, then apply directly inside AfyaLink.
            </p>
          </div>
        </div>

        <section className="section">
          <div className="card premium-card">
            {msg ? <div className="subtle-banner">{msg}</div> : null}

            <label>Search vacancies</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, department, location, benefit or campaign summary"
            />

            {loading ? (
              <p className="muted">Loading...</p>
            ) : (
              <div className="grid cols-2" style={{ marginTop: 12 }}>
                {ads.map((ad) => {
                  const existing = appByAdId.get(String(ad._id));
                  const showApply = String(applyingId) === String(ad._id);
                  const gallery = Array.isArray(ad?.media?.gallery) ? ad.media.gallery : [];

                  return (
                    <div key={ad._id} className="card premium-card recruitment-card">
                      {ad?.media?.coverImage?.publicUrl ? (
                        <img className="recruitment-card-cover" src={ad.media.coverImage.publicUrl} alt={ad.title} />
                      ) : null}
                      <div className="recruitment-card-head">
                        <div>
                          <h4>{ad.title}</h4>
                          <p className="muted">{ad.bannerHeadline || ad.campaignSummary || ad.role || "Hospital opportunity"}</p>
                        </div>
                        <span className="pill">{existing?.status || "OPEN"}</span>
                      </div>

                      <div className="recruitment-meta-grid">
                        <div>
                          <strong>Hospital</strong>
                          <span>{ad?.hospital?.name || "Hospital"}</span>
                        </div>
                        <div>
                          <strong>Location</strong>
                          <span>{ad.location || "Flexible"}</span>
                        </div>
                        <div>
                          <strong>Type</strong>
                          <span>{ad.employmentType || "Not set"}</span>
                        </div>
                        <div>
                          <strong>Work Mode</strong>
                          <span>{ad.workMode || "ONSITE"}</span>
                        </div>
                        <div>
                          <strong>Department</strong>
                          <span>{ad.department || "General"}</span>
                        </div>
                        <div>
                          <strong>Salary</strong>
                          <span>{ad.salaryRange || "Discussed during hiring"}</span>
                        </div>
                      </div>

                      {ad.bannerSubheadline ? <p>{ad.bannerSubheadline}</p> : null}
                      {ad.description ? <p>{ad.description}</p> : null}

                      {ad.highlights?.length ? (
                        <>
                          <strong>Highlights</strong>
                          <div className="recruitment-chip-wrap">
                            {ad.highlights.map((item) => (
                              <span key={`${ad._id}-hl-${item}`} className="tag-chip">{item}</span>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {ad.benefits?.length ? (
                        <>
                          <strong>Benefits</strong>
                          <div className="recruitment-chip-wrap">
                            {ad.benefits.map((item) => (
                              <span key={`${ad._id}-bf-${item}`} className="tag-chip">{item}</span>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {gallery.length ? (
                        <div className="recruitment-gallery-preview">
                          {gallery.slice(0, 4).map((item) => (
                            <img key={item.publicUrl} src={item.publicUrl} alt={item.originalName || ad.title} />
                          ))}
                        </div>
                      ) : null}

                      <div className="row-actions">
                        {existing ? (
                          <span className="muted">Already applied</span>
                        ) : ad.applicationMode === "EXTERNAL" && ad.applyUrl ? (
                          <a
                            className="btn-primary"
                            href={ad.applyUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={trackAndFollow(ad._id, "EXTERNAL_CLICK")}
                          >
                            Apply on External Site
                          </a>
                        ) : (
                          <button type="button" className="btn-primary" onClick={() => startApply(ad._id)}>
                            Apply in AfyaLink
                          </button>
                        )}
                        {ad.careersPageUrl ? (
                          <a
                            className="btn-secondary"
                            href={ad.careersPageUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={trackAndFollow(ad._id, "CAREERS_PAGE_CLICK")}
                          >
                            Careers Page
                          </a>
                        ) : null}
                        {ad.media?.bannerLink ? (
                          <a
                            className="btn-secondary"
                            href={ad.media.bannerLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={trackAndFollow(ad._id, "BANNER_CLICK")}
                          >
                            Campaign Link
                          </a>
                        ) : null}
                        {ad.media?.brochureUrl ? (
                          <a
                            className="btn-secondary"
                            href={ad.media.brochureUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={trackAndFollow(ad._id, "BROCHURE_CLICK")}
                          >
                            Brochure
                          </a>
                        ) : null}
                        {ad.videoUrl ? (
                          <a
                            className="btn-secondary"
                            href={ad.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={trackAndFollow(ad._id, "VIDEO_CLICK")}
                          >
                            Video
                          </a>
                        ) : null}
                      </div>

                      {showApply ? (
                        <div className="card" style={{ margin: "12px 0 0" }}>
                          <h4 style={{ marginTop: 0 }}>Apply: {ad.title}</h4>
                          {ad.visibility === "PRIVATE_LINK" ? (
                            <>
                              <label>Private access code</label>
                              <input
                                value={form.privateAccessToken}
                                onChange={(e) => setForm((p) => ({ ...p, privateAccessToken: e.target.value }))}
                                placeholder="Paste the private application code"
                              />
                            </>
                          ) : null}
                          <label>Full Name</label>
                          <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
                          <label>Email</label>
                          <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                          <label>Phone</label>
                          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                          <label>Resume file</label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                          />
                          <label>Resume URL (optional)</label>
                          <input value={form.resumeUrl} onChange={(e) => setForm((p) => ({ ...p, resumeUrl: e.target.value }))} />
                          <label>Experience Summary</label>
                          <textarea value={form.experienceSummary} onChange={(e) => setForm((p) => ({ ...p, experienceSummary: e.target.value }))} />
                          <label>Cover Letter</label>
                          <textarea value={form.coverLetter} onChange={(e) => setForm((p) => ({ ...p, coverLetter: e.target.value }))} />
                          <div className="row-actions">
                            <button type="button" className="btn-primary" disabled={submitting} onClick={() => submitApplication(ad._id)}>
                              {submitting ? "Submitting..." : "Submit Application"}
                            </button>
                            <button type="button" className="btn-secondary" disabled={submitting} onClick={cancelApply}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {ads.length === 0 ? <div className="card">No vacancies available right now.</div> : null}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }
}
