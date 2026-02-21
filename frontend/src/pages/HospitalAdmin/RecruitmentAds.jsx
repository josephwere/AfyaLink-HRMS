import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";

const emptyForm = {
  title: "",
  role: "",
  department: "",
  employmentType: "FULL_TIME",
  location: "",
  salaryRange: "",
  description: "",
  requirements: "",
  contactEmail: "",
  contactPhone: "",
  applyUrl: "",
  expiresAt: "",
};

export default function RecruitmentAds() {
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("");
  const [adFilter, setAdFilter] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [adsData, appsData] = await Promise.all([
        apiFetch("/api/recruitment-ads?page=1&limit=100"),
        apiFetch("/api/recruitment-ads/applications?page=1&limit=300"),
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
      await apiFetch("/api/recruitment-ads", {
        method: "POST",
        body: {
          ...form,
          requirements: form.requirements,
          expiresAt: form.expiresAt || undefined,
        },
      });
      setMsg("Recruitment ad posted.");
      setForm(emptyForm);
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to post ad (premium required)");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await apiFetch(`/api/recruitment-ads/${id}`, {
        method: "PATCH",
        body: { status },
      });
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Failed to update ad");
    }
  };

  const updateApplicationStatus = async (applicationId, status) => {
    try {
      await apiFetch(`/api/recruitment-ads/applications/${applicationId}/status`, {
        method: "PATCH",
        body: { status },
      });
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

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Recruitment Ads</h2>
          <p className="muted">Post vacancies and manage applicant pipeline in AfyaLink.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Create Vacancy Ad</h3>
        <form className="card premium-card" onSubmit={submit}>
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          <label>Role</label>
          <input value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} placeholder="Doctor, Nurse, Lab Tech..." />
          <label>Department</label>
          <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
          <label>Employment Type</label>
          <select value={form.employmentType} onChange={(e) => setForm((p) => ({ ...p, employmentType: e.target.value }))}>
            <option value="FULL_TIME">FULL_TIME</option>
            <option value="PART_TIME">PART_TIME</option>
            <option value="CONTRACT">CONTRACT</option>
            <option value="LOCUM">LOCUM</option>
          </select>
          <label>Location</label>
          <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
          <label>Salary Range</label>
          <input value={form.salaryRange} onChange={(e) => setForm((p) => ({ ...p, salaryRange: e.target.value }))} placeholder="e.g. 80,000 - 120,000 KES" />
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />
          <label>Requirements (one per line)</label>
          <textarea value={form.requirements} onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))} />
          <label>Contact Email</label>
          <input value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
          <label>Contact Phone</label>
          <input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} />
          <label>Apply URL</label>
          <input value={form.applyUrl} onChange={(e) => setForm((p) => ({ ...p, applyUrl: e.target.value }))} />
          <label>Expiry Date</label>
          <input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
          <button className="btn-primary" disabled={saving}>{saving ? "Posting..." : "Post Vacancy"}</button>
        </form>
      </section>

      <section className="section">
        <h3>My Ads</h3>
        <div className="card premium-card">
          {loading ? <p className="muted">Loading...</p> : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Expiry</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => (
                    <tr key={ad._id}>
                      <td>{ad.title}</td>
                      <td>{ad.department || "—"}</td>
                      <td>{ad.status}</td>
                      <td>{ad.expiresAt ? new Date(ad.expiresAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-secondary" onClick={() => setStatus(ad._id, "ACTIVE")}>Activate</button>
                          <button className="btn-secondary" onClick={() => setStatus(ad._id, "PAUSED")}>Pause</button>
                          <button className="btn-secondary" onClick={() => setStatus(ad._id, "CLOSED")}>Close</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {ads.length === 0 && <tr><td colSpan={5} className="muted">No ads yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Applicants Pipeline</h3>
        <div className="card premium-card">
          <div className="profile-row profile-actions-row" style={{ marginBottom: 12 }}>
            <div>
              <label>Filter by vacancy</label>
              <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)}>
                <option value="">All vacancies</option>
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
                  <th>Vacancy</th>
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
                        <button className="btn-secondary" onClick={() => updateApplicationStatus(a._id, "UNDER_REVIEW")}>Review</button>
                        <button className="btn-secondary" onClick={() => updateApplicationStatus(a._id, "SHORTLISTED")}>Shortlist</button>
                        <button className="btn-secondary" onClick={() => updateApplicationStatus(a._id, "REJECTED")}>Reject</button>
                        <button className="btn-secondary" onClick={() => updateApplicationStatus(a._id, "HIRED")}>Hire</button>
                      </div>
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
