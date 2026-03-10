import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

export default function EscalationQueue({ viewer = "hospital" }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [clinicians, setClinicians] = useState([]);
  const [wards, setWards] = useState([]);
  const [status, setStatus] = useState("OPEN");
  const [missingRequirement, setMissingRequirement] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [ward, setWard] = useState("");
  const [sort, setSort] = useState("NEWEST");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkNote, setBulkNote] = useState("Resolved from escalation queue.");
  const [assignClinicianId, setAssignClinicianId] = useState("");
  const [resolving, setResolving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const isDoctorView = viewer === "doctor";

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (missingRequirement) params.set("missingRequirement", missingRequirement);
      if (clinicianId) params.set("clinicianId", clinicianId);
      if (ward) params.set("ward", ward);
      if (sort) params.set("sort", sort);
      if (q.trim()) params.set("q", q.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await apiFetch(`/api/encounters/escalations?${params.toString()}`);
      setRows(Array.isArray(res?.items) ? res.items : []);
      setClinicians(Array.isArray(res?.clinicians) ? res.clinicians : []);
      setWards(Array.isArray(res?.wards) ? res.wards : []);
      setTotal(Number(res?.total || 0));
      setSelectedIds((prev) => prev.filter((id) => (Array.isArray(res?.items) ? res.items : []).some((item) => String(item.id) === String(id))));
    } catch (err) {
      setMsg(err?.message || "Could not load escalation queue.");
      setRows([]);
      setClinicians([]);
      setWards([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, missingRequirement, clinicianId, ward, sort, page, pageSize]);

  const summary = useMemo(
    () => ({
      open: status === "OPEN" ? total : rows.filter((row) => row.status === "OPEN").length,
      resolved: status === "RESOLVED" ? total : rows.filter((row) => row.status === "RESOLVED").length,
    }),
    [rows, status, total]
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const applyQuickFilter = (next) => {
    setPage(1);
    if (Object.prototype.hasOwnProperty.call(next, "status")) setStatus(next.status);
    if (Object.prototype.hasOwnProperty.call(next, "missingRequirement")) {
      setMissingRequirement(next.missingRequirement);
    }
    if (Object.prototype.hasOwnProperty.call(next, "clinicianId")) setClinicianId(next.clinicianId);
    if (Object.prototype.hasOwnProperty.call(next, "ward")) setWard(next.ward);
    if (Object.prototype.hasOwnProperty.call(next, "sort")) setSort(next.sort);
    if (Object.prototype.hasOwnProperty.call(next, "q")) setQ(next.q);
  };
  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(String(id))
        ? prev.filter((item) => item !== String(id))
        : [...prev, String(id)]
    );
  };
  const togglePageSelection = () => {
    const openIds = rows.filter((item) => item.status === "OPEN").map((item) => String(item.id));
    const allSelected = openIds.length > 0 && openIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected
        ? prev.filter((id) => !openIds.includes(id))
        : [...new Set([...prev, ...openIds])]
    );
  };
  const bulkResolve = async () => {
    if (!selectedIds.length) return;
    try {
      setResolving(true);
      setMsg("");
      const res = await apiFetch("/api/encounters/escalations/bulk-resolve", {
        method: "POST",
        body: {
          encounterIds: selectedIds,
          note: bulkNote,
        },
      });
      setMsg(`Resolved ${res?.resolved || 0} escalation notifications across ${res?.encounters || 0} visits.`);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setMsg(err?.message || "Bulk resolve failed.");
    } finally {
      setResolving(false);
    }
  };
  const bulkAssign = async () => {
    if (!selectedIds.length || !assignClinicianId) return;
    try {
      setAssigning(true);
      setMsg("");
      const res = await apiFetch("/api/encounters/escalations/bulk-assign", {
        method: "POST",
        body: {
          encounterIds: selectedIds,
          clinicianId: assignClinicianId,
        },
      });
      setMsg(`Assigned ${res?.updated || 0} visits to clinician.`);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setMsg(err?.message || "Bulk assign failed.");
    } finally {
      setAssigning(false);
    }
  };
  const bulkReview = async () => {
    if (!selectedIds.length) return;
    try {
      setReviewing(true);
      setMsg("");
      const res = await apiFetch("/api/encounters/escalations/bulk-review", {
        method: "POST",
        body: { encounterIds: selectedIds },
      });
      setMsg(`Marked ${res?.reviewed || 0} escalation notices as reviewed.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Bulk review failed.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>{isDoctorView ? "My Escalations" : "Escalation Queue"}</h2>
          <p className="muted">
            {isDoctorView
              ? "Review and resolve your open ward blockers without leaving the doctor workspace."
              : "Triage ward blockers by status, clinician, and missing handoff type."}
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <div className="card"><strong>Open</strong><div>{summary.open}</div></div>
          <div className="card"><strong>Resolved</strong><div>{summary.resolved}</div></div>
          <div className="card"><strong>Total</strong><div>{rows.length}</div></div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="grid" style={{ gap: 12 }}>
            <label>
              Search
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Patient, ward, clinician, note"
              />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ALL">All</option>
              </select>
            </label>
            <label>
              Missing Requirement
              <select value={missingRequirement} onChange={(e) => setMissingRequirement(e.target.value)}>
                <option value="">All</option>
                <option value="DIAGNOSIS">Diagnosis</option>
                <option value="BILLING">Billing</option>
                <option value="PRESCRIPTION">Prescription</option>
              </select>
            </label>
            <label>
              Clinician
              {isDoctorView ? (
                <input value="My escalations" disabled />
              ) : (
                <select value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
                  <option value="">All clinicians</option>
                  {clinicians.map((item) => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
              )}
            </label>
            <label>
              Ward
              <select value={ward} onChange={(e) => setWard(e.target.value)}>
                <option value="">All wards</option>
                {wards.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="NEWEST">Newest</option>
                <option value="OLDEST">Oldest</option>
                <option value="PRIORITY">Priority</option>
                <option value="PATIENT">Patient</option>
                <option value="CLINICIAN">Clinician</option>
                <option value="WARD">Ward</option>
              </select>
            </label>
            <label>
              Page Size
              <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="button" className="btn-secondary" onClick={() => { setPage(1); load(); }}>Apply Filters</button>
            </div>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`action-pill ${status === "OPEN" && !missingRequirement ? "active" : ""}`}
              onClick={() => applyQuickFilter({ status: "OPEN", missingRequirement: "" })}
            >
              Open Only
            </button>
            <button
              type="button"
              className={`action-pill ${status === "OPEN" && missingRequirement === "DIAGNOSIS" ? "active" : ""}`}
              onClick={() => applyQuickFilter({ status: "OPEN", missingRequirement: "DIAGNOSIS" })}
            >
              Diagnosis Blockers
            </button>
            <button
              type="button"
              className={`action-pill ${status === "OPEN" && missingRequirement === "BILLING" ? "active" : ""}`}
              onClick={() => applyQuickFilter({ status: "OPEN", missingRequirement: "BILLING" })}
            >
              Billing Blockers
            </button>
            <button
              type="button"
              className={`action-pill ${status === "OPEN" && missingRequirement === "PRESCRIPTION" ? "active" : ""}`}
              onClick={() => applyQuickFilter({ status: "OPEN", missingRequirement: "PRESCRIPTION" })}
            >
              Prescription Blockers
            </button>
            <button
              type="button"
              className={`action-pill ${status === "ALL" && !missingRequirement && !clinicianId && !ward && !q.trim() ? "active" : ""}`}
              onClick={() =>
                applyQuickFilter({
                  status: "ALL",
                  missingRequirement: "",
                  clinicianId: "",
                  ward: "",
                  q: "",
                  sort: "NEWEST",
                })
              }
            >
              Clear Filters
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
          <div className="muted">
            Showing {rows.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)}` : "0"} of {total}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <div className="action-pill">Page {page} / {totalPages}</div>
            <button type="button" className="btn-secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="grid" style={{ gap: 12 }}>
            <label>
              Resolution Note
              <input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Queue resolution note"
              />
            </label>
            <label>
              Assign Clinician
              {isDoctorView ? (
                <input value="Admin only" disabled />
              ) : (
                <select value={assignClinicianId} onChange={(e) => setAssignClinicianId(e.target.value)}>
                  <option value="">Select clinician</option>
                  {clinicians.map((item) => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
              )}
            </label>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={togglePageSelection}
                disabled={!rows.some((item) => item.status === "OPEN")}
              >
                Select Open On Page
              </button>
              {!isDoctorView ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={bulkAssign}
                  disabled={!selectedIds.length || !assignClinicianId || assigning}
                >
                  {assigning ? "Assigning..." : "Assign Clinician"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={bulkReview}
                disabled={!selectedIds.length || reviewing}
              >
                {reviewing ? "Marking..." : "Mark Reviewed"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={bulkResolve}
                disabled={!selectedIds.length || resolving}
              >
                {resolving ? "Resolving..." : `Resolve Selected (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Patient</th>
                  <th>Ward</th>
                  <th>Clinician</th>
                  <th>Status</th>
                  <th>Missing</th>
                  <th>Latest</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(String(item.id))}
                        disabled={item.status !== "OPEN"}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </td>
                    <td>
                      <strong>{item.patientName}</strong>
                      <div className="muted">{item.nationalId || "—"}</div>
                    </td>
                    <td>{item.ward || "—"}</td>
                    <td>{item.clinicianName || "—"}</td>
                    <td>
                      <span className={`action-pill${item.status === "OPEN" ? " warning" : ""}`}>{item.status}</span>
                      {item.reviewedAt ? <div className="action-pill">Reviewed</div> : null}
                    </td>
                    <td>{item.missingRequirements?.length ? item.missingRequirements.join(", ") : "—"}</td>
                    <td>
                      <div className="muted">{item.latestBody || "—"}</div>
                    </td>
                    <td>
                      <div className="doctor-actions-row">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(item.path || "/hospital-admin/consultation-monitor")}
                        >
                          Open Workflow
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="muted">No escalation items match this filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
