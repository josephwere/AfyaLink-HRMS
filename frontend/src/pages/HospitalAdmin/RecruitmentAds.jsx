import React, { useEffect, useMemo, useState } from "react";
import {
  createRecruitmentAd,
  listRecruitmentAds,
  listRecruitmentApplications,
  updateRecruitmentAd,
  updateRecruitmentApplicationStatus,
} from "../../services/recruitmentAdsApi";

const emptyForm = {
  title: "",
  role: "",
  department: "",
  employmentType: "FULL_TIME",
  workMode: "ONSITE",
  location: "",
  salaryRange: "",
  hiringCount: 1,
  seniorityLevel: "",
  description: "",
  campaignSummary: "",
  bannerHeadline: "",
  bannerSubheadline: "",
  requirements: "",
  benefits: "",
  highlights: "",
  tags: "",
  contactEmail: "",
  contactPhone: "",
  applyUrl: "",
  careersPageUrl: "",
  videoUrl: "",
  bannerLink: "",
  brochureUrl: "",
  applicationMode: "INTERNAL",
  visibility: "PUBLIC",
  featured: false,
  priority: 50,
  campaignStartAt: "",
  expiresAt: "",
};

const sourceLabels = {
  LOGIN_PAGE: "Login",
  REGISTER_PAGE: "Register",
  PATIENT_DASHBOARD: "Patient Dashboard",
  PATIENT_FEED: "Patient Feed",
  DIRECT_CAREERS: "Direct Careers",
};

function formatSourceLabel(source) {
  return sourceLabels[source] || String(source || "").replace(/_/g, " ");
}

function appendFormData(form, coverImage, galleryImages) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "boolean") {
      data.append(key, value ? "true" : "false");
      return;
    }
    if (String(value) !== "") data.append(key, String(value));
  });
  if (coverImage) data.append("coverImage", coverImage);
  Array.from(galleryImages || []).forEach((file) => data.append("galleryImages", file));
  return data;
}

export default function RecruitmentAds() {
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [coverImage, setCoverImage] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [editingAdId, setEditingAdId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [adFilter, setAdFilter] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [adsData, appsData] = await Promise.all([
        listRecruitmentAds({ page: 1, limit: 100 }),
        listRecruitmentApplications({ page: 1, limit: 300 }),
      ]);
      setAds(Array.isArray(adsData?.items) ? adsData.items : []);
      setApplications(Array.isArray(appsData?.items) ? appsData.items : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load recruitment data");
      setAds([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = appendFormData(form, coverImage, galleryImages);
      if (editingAdId) {
        await updateRecruitmentAd(editingAdId, payload);
        setMsg("Recruitment campaign updated.");
      } else {
        await createRecruitmentAd(payload);
        setMsg("Recruitment campaign published.");
      }
      setForm(emptyForm);
      setCoverImage(null);
      setGalleryImages([]);
      setEditingAdId("");
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to save recruitment campaign");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      const data = new FormData();
      data.append("status", status);
      await updateRecruitmentAd(id, data);
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to update ad");
    }
  };

  const startEdit = (ad) => {
    setEditingAdId(ad._id);
    setForm({
      title: ad.title || "",
      role: ad.role || "",
      department: ad.department || "",
      employmentType: ad.employmentType || "FULL_TIME",
      workMode: ad.workMode || "ONSITE",
      location: ad.location || "",
      salaryRange: ad.salaryRange || "",
      hiringCount: ad.hiringCount || 1,
      seniorityLevel: ad.seniorityLevel || "",
      description: ad.description || "",
      campaignSummary: ad.campaignSummary || "",
      bannerHeadline: ad.bannerHeadline || "",
      bannerSubheadline: ad.bannerSubheadline || "",
      requirements: (ad.requirements || []).join("\n"),
      benefits: (ad.benefits || []).join("\n"),
      highlights: (ad.highlights || []).join("\n"),
      tags: (ad.tags || []).join(", "),
      contactEmail: ad.contactEmail || "",
      contactPhone: ad.contactPhone || "",
      applyUrl: ad.applyUrl || "",
      careersPageUrl: ad.careersPageUrl || "",
      videoUrl: ad.videoUrl || "",
      bannerLink: ad?.media?.bannerLink || "",
      brochureUrl: ad?.media?.brochureUrl || "",
      applicationMode: ad.applicationMode || "INTERNAL",
      visibility: ad.visibility || "PUBLIC",
      featured: Boolean(ad.featured),
      priority: ad.priority || 50,
      campaignStartAt: ad.campaignStartAt ? String(ad.campaignStartAt).slice(0, 10) : "",
      expiresAt: ad.expiresAt ? String(ad.expiresAt).slice(0, 10) : "",
    });
    setMsg(`Editing campaign: ${ad.title}`);
  };

  const resetEditor = () => {
    setEditingAdId("");
    setForm(emptyForm);
    setCoverImage(null);
    setGalleryImages([]);
  };

  const updateApplicationStatus = async (applicationId, status) => {
    try {
      await updateRecruitmentApplicationStatus(applicationId, status);
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to update application status");
    }
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (adFilter && String(a?.ad?._id || a?.ad) !== String(adFilter)) return false;
      return true;
    });
  }, [applications, statusFilter, adFilter]);

  const applicationStatsByAd = useMemo(() => {
    const map = new Map();
    applications.forEach((item) => {
      const adId = String(item?.ad?._id || item?.ad || "");
      if (!adId) return;
      const row = map.get(adId) || {
        total: 0,
        shortlisted: 0,
        hired: 0,
        underReview: 0,
      };
      row.total += 1;
      if (item.status === "SHORTLISTED") row.shortlisted += 1;
      if (item.status === "HIRED") row.hired += 1;
      if (item.status === "UNDER_REVIEW") row.underReview += 1;
      map.set(adId, row);
    });
    return map;
  }, [applications]);

  const dashboardStats = useMemo(() => {
    const featured = ads.filter((ad) => ad.featured).length;
    const externalReady = ads.filter((ad) => ad.applicationMode === "EXTERNAL" || ad.applicationMode === "HYBRID").length;
    const totalApplicants = applications.length;
    const shortlisted = applications.filter((item) => item.status === "SHORTLISTED").length;
    const hired = applications.filter((item) => item.status === "HIRED").length;
    return {
      campaigns: ads.length,
      featured,
      externalReady,
      totalApplicants,
      shortlisted,
      hired,
    };
  }, [ads, applications]);

  const sourcePerformance = useMemo(() => {
    const sourceMap = new Map();

    ads.forEach((ad) => {
      const sourceAttribution = ad?.analytics?.sourceAttribution || {};
      const eventSourceAttribution = ad?.analytics?.eventSourceAttribution || {};

      Object.entries(sourceAttribution).forEach(([sourceKey, views]) => {
        const row = sourceMap.get(sourceKey) || {
          source: sourceKey,
          views: 0,
          applyIntent: 0,
          internalApply: 0,
          externalClick: 0,
          careersClick: 0,
          brochureClick: 0,
          videoClick: 0,
          bannerClick: 0,
        };
        row.views += Number(views || 0);
        row.applyIntent += Number(eventSourceAttribution?.applyIntentCount?.[sourceKey] || 0);
        row.internalApply += Number(eventSourceAttribution?.internalApplyCount?.[sourceKey] || 0);
        row.externalClick += Number(eventSourceAttribution?.externalClickCount?.[sourceKey] || 0);
        row.careersClick += Number(eventSourceAttribution?.careersPageClickCount?.[sourceKey] || 0);
        row.brochureClick += Number(eventSourceAttribution?.brochureClickCount?.[sourceKey] || 0);
        row.videoClick += Number(eventSourceAttribution?.videoClickCount?.[sourceKey] || 0);
        row.bannerClick += Number(eventSourceAttribution?.bannerClickCount?.[sourceKey] || 0);
        sourceMap.set(sourceKey, row);
      });
    });

    const rows = Array.from(sourceMap.values())
      .map((row) => {
        const applyIntentRate = row.views ? (row.applyIntent / row.views) * 100 : 0;
        const conversionRate = row.views ? (row.internalApply / row.views) * 100 : 0;
        return {
          ...row,
          applyIntentRate,
          conversionRate,
        };
      })
      .sort((a, b) => b.views - a.views);

    const totals = rows.reduce(
      (acc, row) => {
        acc.views += row.views;
        acc.applyIntent += row.applyIntent;
        acc.internalApply += row.internalApply;
        acc.externalClick += row.externalClick;
        return acc;
      },
      { views: 0, applyIntent: 0, internalApply: 0, externalClick: 0 },
    );

    return { rows, totals };
  }, [ads]);

  const coverPreview = coverImage ? URL.createObjectURL(coverImage) : "";
  const galleryPreview = Array.from(galleryImages || []).map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Recruitment Ads</h2>
          <p className="muted">Create high-standard hiring campaigns with banners, gallery media, CTA links, highlights, and structured applicant flow.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="grid info-grid">
          <div className="card premium-card">
            <h3>Live Campaigns</h3>
            <div className="card-value">{dashboardStats.campaigns}</div>
            <p className="muted">All recruitment campaigns currently created in this hospital.</p>
          </div>
          <div className="card premium-card">
            <h3>Featured Campaigns</h3>
            <div className="card-value">{dashboardStats.featured}</div>
            <p className="muted">High-priority roles pinned above the rest of the hiring feed.</p>
          </div>
          <div className="card premium-card">
            <h3>Total Applicants</h3>
            <div className="card-value">{dashboardStats.totalApplicants}</div>
            <p className="muted">
              {dashboardStats.shortlisted} shortlisted, {dashboardStats.hired} hired.
            </p>
          </div>
          <div className="card premium-card">
            <h3>External / Hybrid Ready</h3>
            <div className="card-value">{dashboardStats.externalReady}</div>
            <p className="muted">Campaigns with external or hybrid application routes, links, and richer media.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="recruitment-analytics-head">
            <div>
              <h3>Source Performance</h3>
              <p className="muted">Track where applicants discover your campaigns and how each source converts into real applications.</p>
            </div>
            <div className="recruitment-chip-wrap">
              <span className="tag-chip">Views: {sourcePerformance.totals.views}</span>
              <span className="tag-chip">Intent: {sourcePerformance.totals.applyIntent}</span>
              <span className="tag-chip">Applied: {sourcePerformance.totals.internalApply}</span>
              <span className="tag-chip">External Clicks: {sourcePerformance.totals.externalClick}</span>
            </div>
          </div>

          {sourcePerformance.rows.length ? (
            <div className="recruitment-source-grid">
              {sourcePerformance.rows.map((row) => (
                <div key={row.source} className="recruitment-source-card">
                  <div className="recruitment-source-top">
                    <div>
                      <h4>{formatSourceLabel(row.source)}</h4>
                      <p className="muted">Views {row.views} • Intent {row.applyIntent} • Applied {row.internalApply}</p>
                    </div>
                    <span className="pill">{row.conversionRate.toFixed(1)}% applied</span>
                  </div>

                  <div className="recruitment-source-metrics">
                    <div>
                      <strong>Apply intent</strong>
                      <span>{row.applyIntentRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <strong>Apply conversion</strong>
                      <span>{row.conversionRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <strong>External clicks</strong>
                      <span>{row.externalClick}</span>
                    </div>
                    <div>
                      <strong>Campaign CTA clicks</strong>
                      <span>{row.careersClick + row.bannerClick + row.videoClick + row.brochureClick}</span>
                    </div>
                  </div>

                  <div className="recruitment-source-bars">
                    <div>
                      <div className="recruitment-source-bar-label">
                        <span>Intent</span>
                        <span>{row.applyIntent}</span>
                      </div>
                      <div className="recruitment-source-bar-track">
                        <div className="recruitment-source-bar-fill recruitment-source-bar-intent" style={{ width: `${Math.min(100, row.applyIntentRate)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="recruitment-source-bar-label">
                        <span>Applied</span>
                        <span>{row.internalApply}</span>
                      </div>
                      <div className="recruitment-source-bar-track">
                        <div className="recruitment-source-bar-fill recruitment-source-bar-convert" style={{ width: `${Math.min(100, row.conversionRate)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="recruitment-chip-wrap">
                    <span className="tag-chip">Careers: {row.careersClick}</span>
                    <span className="tag-chip">Banner: {row.bannerClick}</span>
                    <span className="tag-chip">Video: {row.videoClick}</span>
                    <span className="tag-chip">Brochure: {row.brochureClick}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-sub">No source traffic yet. Share your campaigns from login, register, dashboard, or the public careers page to start collecting attribution.</div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>{editingAdId ? "Edit Recruitment Campaign" : "Create Recruitment Campaign"}</h3>
        <form className="card premium-card form" onSubmit={submit}>
          <label>Campaign Title</label>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />

          <div className="row-actions">
            <div>
              <label>Role</label>
              <input value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} placeholder="Doctor, Nurse, Lab Tech..." />
            </div>
            <div>
              <label>Department</label>
              <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Employment Type</label>
              <select value={form.employmentType} onChange={(e) => setForm((p) => ({ ...p, employmentType: e.target.value }))}>
                <option value="FULL_TIME">FULL_TIME</option>
                <option value="PART_TIME">PART_TIME</option>
                <option value="CONTRACT">CONTRACT</option>
                <option value="LOCUM">LOCUM</option>
              </select>
            </div>
            <div>
              <label>Work Mode</label>
              <select value={form.workMode} onChange={(e) => setForm((p) => ({ ...p, workMode: e.target.value }))}>
                <option value="ONSITE">ONSITE</option>
                <option value="HYBRID">HYBRID</option>
                <option value="REMOTE">REMOTE</option>
                <option value="FLEXIBLE">FLEXIBLE</option>
              </select>
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <label>Salary Range</label>
              <input value={form.salaryRange} onChange={(e) => setForm((p) => ({ ...p, salaryRange: e.target.value }))} placeholder="80,000 - 120,000 KES" />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Hiring Count</label>
              <input type="number" min="1" value={form.hiringCount} onChange={(e) => setForm((p) => ({ ...p, hiringCount: e.target.value }))} />
            </div>
            <div>
              <label>Seniority Level</label>
              <input value={form.seniorityLevel} onChange={(e) => setForm((p) => ({ ...p, seniorityLevel: e.target.value }))} placeholder="Entry, Mid, Senior, Lead" />
            </div>
          </div>

          <label>Campaign Summary</label>
          <textarea rows={2} value={form.campaignSummary} onChange={(e) => setForm((p) => ({ ...p, campaignSummary: e.target.value }))} placeholder="Short campaign pitch shown on cards and previews." />

          <label>Banner Headline</label>
          <input value={form.bannerHeadline} onChange={(e) => setForm((p) => ({ ...p, bannerHeadline: e.target.value }))} placeholder="Join our critical care team" />

          <label>Banner Subheadline</label>
          <input value={form.bannerSubheadline} onChange={(e) => setForm((p) => ({ ...p, bannerSubheadline: e.target.value }))} placeholder="Work with advanced tools, strong mentorship, and real patient impact." />

          <label>Description</label>
          <textarea rows={5} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />

          <div className="row-actions">
            <div>
              <label>Requirements (one per line)</label>
              <textarea rows={4} value={form.requirements} onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))} />
            </div>
            <div>
              <label>Benefits (one per line)</label>
              <textarea rows={4} value={form.benefits} onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))} />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Highlights (one per line)</label>
              <textarea rows={4} value={form.highlights} onChange={(e) => setForm((p) => ({ ...p, highlights: e.target.value }))} placeholder="New ICU wing&#10;Scholarship support&#10;Relocation package" />
            </div>
            <div>
              <label>Tags (comma-separated)</label>
              <textarea rows={4} value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="critical care, urgent hiring, relocation" />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Contact Email</label>
              <input value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
            </div>
            <div>
              <label>Contact Phone</label>
              <input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Application Mode</label>
              <select value={form.applicationMode} onChange={(e) => setForm((p) => ({ ...p, applicationMode: e.target.value }))}>
                <option value="INTERNAL">INTERNAL</option>
                <option value="EXTERNAL">EXTERNAL</option>
                <option value="HYBRID">HYBRID</option>
              </select>
            </div>
            <div>
              <label>Visibility</label>
              <select value={form.visibility} onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))}>
                <option value="PUBLIC">PUBLIC</option>
                <option value="STAFF_ONLY">STAFF_ONLY</option>
                <option value="PRIVATE_LINK">PRIVATE_LINK</option>
              </select>
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Apply URL</label>
              <input value={form.applyUrl} onChange={(e) => setForm((p) => ({ ...p, applyUrl: e.target.value }))} placeholder="Required for EXTERNAL or HYBRID campaigns" />
            </div>
            <div>
              <label>Careers Page URL</label>
              <input value={form.careersPageUrl} onChange={(e) => setForm((p) => ({ ...p, careersPageUrl: e.target.value }))} />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Video URL</label>
              <input value={form.videoUrl} onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))} placeholder="YouTube, Vimeo, etc." />
            </div>
            <div>
              <label>Banner Link</label>
              <input value={form.bannerLink} onChange={(e) => setForm((p) => ({ ...p, bannerLink: e.target.value }))} placeholder="Campaign landing page or microsite" />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Brochure URL</label>
              <input value={form.brochureUrl} onChange={(e) => setForm((p) => ({ ...p, brochureUrl: e.target.value }))} placeholder="PDF brochure or media kit" />
            </div>
            <div>
              <label>Campaign Start</label>
              <input type="date" value={form.campaignStartAt} onChange={(e) => setForm((p) => ({ ...p, campaignStartAt: e.target.value }))} />
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Expiry Date</label>
              <input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
            </div>
            <div>
              <label>Priority</label>
              <input type="number" min="1" max="100" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} />
            </div>
          </div>

          <label className="profile-inline-check">
            <input type="checkbox" checked={Boolean(form.featured)} onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} />
            <span>Feature this campaign on top</span>
          </label>

          <div className="row-actions">
            <div>
              <label>Cover Image / Banner</label>
              <input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} />
              {coverPreview ? <img src={coverPreview} alt="Cover preview" className="recruitment-cover-preview" /> : null}
            </div>
            <div>
              <label>Gallery Images</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setGalleryImages(Array.from(e.target.files || []))} />
              {galleryPreview.length ? (
                <div className="recruitment-gallery-preview">
                  {galleryPreview.map((row) => (
                    <img key={row.name} src={row.url} alt={row.name} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="row-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingAdId ? "Update Campaign" : "Publish Campaign"}
            </button>
            {editingAdId ? (
              <button type="button" className="btn-secondary" onClick={resetEditor}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="section">
        <h3>Live Campaigns</h3>
        <div className="grid info-grid">
          {ads.map((ad) => (
            <div key={ad._id} className="card premium-card recruitment-card">
              {(() => {
                const stats = applicationStatsByAd.get(String(ad._id)) || {
                  total: 0,
                  shortlisted: 0,
                  hired: 0,
                  underReview: 0,
                };
                return (
                  <>
              {ad?.media?.coverImage?.publicUrl ? (
                <img className="recruitment-card-cover" src={ad.media.coverImage.publicUrl} alt={ad.title} />
              ) : null}
              <div className="recruitment-card-head">
                <div>
                  <h4>{ad.title}</h4>
                  <p className="muted">{ad.bannerHeadline || ad.campaignSummary || ad.department || "Recruitment campaign"}</p>
                </div>
                <div className="action-list">
                  {ad.featured ? <span className="pill">Featured</span> : null}
                  <span className="pill">{ad.status}</span>
                </div>
              </div>
              <p>{ad.bannerSubheadline || ad.description?.slice(0, 180) || "—"}</p>
              <div className="recruitment-meta-grid">
                <div><strong>Role</strong><span>{ad.role || "—"}</span></div>
                <div><strong>Mode</strong><span>{ad.workMode || "—"}</span></div>
                <div><strong>Apply</strong><span>{ad.applicationMode || "—"}</span></div>
                <div><strong>Visibility</strong><span>{ad.visibility || "PUBLIC"}</span></div>
                <div><strong>Applicants</strong><span>{stats.total}</span></div>
                <div><strong>Reviewing</strong><span>{stats.underReview}</span></div>
                <div><strong>Shortlisted</strong><span>{stats.shortlisted}</span></div>
                <div><strong>Hired</strong><span>{stats.hired}</span></div>
                <div><strong>Views</strong><span>{ad?.analytics?.viewCount || 0}</span></div>
                <div><strong>Apply Intent</strong><span>{ad?.analytics?.applyIntentCount || 0}</span></div>
                <div><strong>Internal Apply</strong><span>{ad?.analytics?.internalApplyCount || 0}</span></div>
                <div><strong>External Clicks</strong><span>{ad?.analytics?.externalClickCount || 0}</span></div>
              </div>
              {(ad.highlights || []).length ? (
                <div className="recruitment-chip-wrap">
                  {ad.highlights.map((item, idx) => (
                    <span key={`${ad._id}-hl-${idx}`} className="pill">{item}</span>
                  ))}
                </div>
              ) : null}
              {(ad.tags || []).length ? (
                <div className="recruitment-chip-wrap">
                  {ad.tags.map((item, idx) => (
                    <span key={`${ad._id}-tag-${idx}`} className="tag-chip">{item}</span>
                  ))}
                </div>
              ) : null}
              <div className="row-actions">
                {ad.careersPageUrl ? (
                  <a className="btn-secondary" href={ad.careersPageUrl} target="_blank" rel="noreferrer">
                    Careers Page
                  </a>
                ) : null}
                {ad.videoUrl ? (
                  <a className="btn-secondary" href={ad.videoUrl} target="_blank" rel="noreferrer">
                    Campaign Video
                  </a>
                ) : null}
                {ad?.media?.brochureUrl ? (
                  <a className="btn-secondary" href={ad.media.brochureUrl} target="_blank" rel="noreferrer">
                    Brochure
                  </a>
                ) : null}
                {ad?.media?.bannerLink ? (
                  <a className="btn-secondary" href={ad.media.bannerLink} target="_blank" rel="noreferrer">
                    Campaign Link
                  </a>
                ) : null}
              </div>
              <div className="recruitment-chip-wrap">
                <span className="tag-chip">Careers clicks: {ad?.analytics?.careersPageClickCount || 0}</span>
                <span className="tag-chip">Banner clicks: {ad?.analytics?.bannerClickCount || 0}</span>
                <span className="tag-chip">Brochure clicks: {ad?.analytics?.brochureClickCount || 0}</span>
                <span className="tag-chip">Video clicks: {ad?.analytics?.videoClickCount || 0}</span>
              </div>
              {ad?.analytics?.sourceAttribution ? (
                <div className="recruitment-chip-wrap">
                  {Object.entries(ad.analytics.sourceAttribution)
                    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
                    .map(([sourceKey, count]) => (
                      <span key={`${ad._id}-${sourceKey}`} className="tag-chip">
                        {sourceKey.replace(/_/g, " ")}: {count}
                      </span>
                    ))}
                </div>
              ) : null}
              <div className="row-actions">
                <button type="button" className="btn-secondary" onClick={() => startEdit(ad)}>Edit</button>
                <button type="button" className="btn-secondary" onClick={() => setStatus(ad._id, "ACTIVE")}>Activate</button>
                <button type="button" className="btn-secondary" onClick={() => setStatus(ad._id, "PAUSED")}>Pause</button>
                <button type="button" className="btn-secondary" onClick={() => setStatus(ad._id, "CLOSED")}>Close</button>
              </div>
                  </>
                );
              })()}
            </div>
          ))}
          {!ads.length && !loading ? <div className="card">No recruitment campaigns yet.</div> : null}
        </div>
      </section>

      <section className="section">
        <h3>Applicants Pipeline</h3>
        <div className="card premium-card">
          <div className="profile-row profile-actions-row" style={{ marginBottom: 12 }}>
            <div>
              <label>Filter by campaign</label>
              <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)}>
                <option value="">All campaigns</option>
                {ads.map((ad) => (
                  <option key={ad._id} value={ad._id}>{ad.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Filter by status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="NEW">NEW</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="SHORTLISTED">SHORTLISTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="HIRED">HIRED</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Campaign</th>
                  <th>Role</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <strong>{a.fullName || a?.applicant?.name || "Unknown"}</strong>
                      <div className="muted">{a.email || a?.applicant?.email || "—"}</div>
                      {a.phone ? <div className="muted">{a.phone}</div> : null}
                    </td>
                    <td>{a?.ad?.title || "—"}</td>
                    <td>{a.applicantRole || a?.applicant?.role || "—"}</td>
                    <td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}</td>
                    <td>{a.status}</td>
                    <td>
                      <div className="row-actions">
                        {a.resumeFile?.publicUrl ? (
                          <a
                            className="btn-secondary btn-compact"
                            href={a.resumeFile.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Resume File
                          </a>
                        ) : null}
                        {a.resumeUrl ? (
                          <a className="btn-secondary btn-compact" href={a.resumeUrl} target="_blank" rel="noreferrer">
                            Resume Link
                          </a>
                        ) : null}
                        <button type="button" className="btn-secondary btn-compact" onClick={() => updateApplicationStatus(a._id, "UNDER_REVIEW")}>Review</button>
                        <button type="button" className="btn-secondary btn-compact" onClick={() => updateApplicationStatus(a._id, "SHORTLISTED")}>Shortlist</button>
                        <button type="button" className="btn-secondary btn-compact" onClick={() => updateApplicationStatus(a._id, "REJECTED")}>Reject</button>
                        <button type="button" className="btn-secondary btn-compact" onClick={() => updateApplicationStatus(a._id, "HIRED")}>Hire</button>
                      </div>
                      {a.experienceSummary ? <div className="muted" style={{ marginTop: 8 }}>{a.experienceSummary}</div> : null}
                      {a.coverLetter ? <div className="muted" style={{ marginTop: 8 }}>{a.coverLetter}</div> : null}
                    </td>
                  </tr>
                ))}
                {filteredApplications.length === 0 && (
                  <tr><td colSpan={6} className="muted">No applications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
