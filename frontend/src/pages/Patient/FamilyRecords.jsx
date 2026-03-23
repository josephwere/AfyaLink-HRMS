import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { StatCard } from "../../components/Cards";
import { listMyReports } from "../../services/reportsApi";

export default function FamilyRecords() {
  const navigate = useNavigate();
  const [family, setFamily] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/profile/family"),
      apiFetch("/api/encounters?limit=50"),
      listMyReports({ cursorMode: true, limit: 25 }),
    ])
      .then(([familyRes, encounterRows, reportRes]) => {
        const linked = Array.isArray(familyRes?.items) ? familyRes.items : [];
        const patientIds = new Set(linked.map((item) => String(item.patientId)));
        const encounterItems = Array.isArray(encounterRows) ? encounterRows : [];
        const reportItems = Array.isArray(reportRes?.items) ? reportRes.items : Array.isArray(reportRes) ? reportRes : [];

        setFamily(linked);
        setEncounters(
          encounterItems.filter((row) => patientIds.has(String(row?.patient?._id || row?.patient || "")))
        );
        setReports(
          reportItems.filter((row) => patientIds.has(String(row?.patient?._id || row?.patient || "")))
        );
      })
      .catch((err) => {
        setFamily([]);
        setEncounters([]);
        setReports([]);
        setMsg(err?.message || "Failed to load family records.");
      });
  }, []);

  const totals = useMemo(
    () => ({
      children: family.length,
      appointments: family.reduce((sum, item) => sum + Number(item?.upcomingAppointments || 0), 0),
      encounters: family.reduce((sum, item) => sum + Number(item?.totalEncounters || 0), 0),
      reports: reports.length,
    }),
    [family, reports]
  );

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Family Records</h2>
          <p className="muted">
            Parent-facing view of linked minor care records, reports, and recent encounter activity.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/profile")}>
            Manage Linked Children
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/notifications?category=WELLNESS")}>
            Daily Quotes
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/billing")}>
            Billing View
          </button>
        </div>
      </div>

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Linked Children" value={totals.children} onClick={() => navigate("/profile")} />
          <StatCard title="Upcoming Visits" value={totals.appointments} onClick={() => navigate("/patient/appointments")} />
          <StatCard title="Tracked Encounters" value={totals.encounters} onClick={() => navigate("/patient/medical-records")} />
          <StatCard title="Clinical Reports" value={totals.reports} onClick={() => navigate("/reports")} />
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Linked Child Profiles</h3>
              <p className="muted">Each child linked to your account with recent care signals.</p>
            </div>
            <div className="action-pill">{family.length} profiles</div>
          </div>

          {family.length ? (
            <div className="panel-grid" style={{ marginTop: 12 }}>
              {family.map((item) => (
                <div key={item.patientId} className="card premium-card">
                  <h4>{item.name}</h4>
                  <p className="muted">
                    {item.relationship || "Parent"} • Age {item.age ?? "—"} • {item.hospitalName || "Hospital not set"}
                  </p>
                  <p className="muted">
                    Upcoming appointments: {item.upcomingAppointments} • Encounters: {item.totalEncounters} • Reports: {reports.filter((row) => String(row?.patient?._id || row?.patient || "") === String(item.patientId)).length}
                  </p>
                  <p className="muted">Latest diagnosis: {item.latestDiagnosis || "No diagnosis captured yet"}</p>
                  <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn-secondary" onClick={() => navigate("/patient/medical-records")}>
                      Open Timeline
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>
                      Open Reports
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              No linked child records yet. Use Profile to link a minor account.
            </div>
          )}
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Recent Encounter Activity</h3>
          {encounters.length ? (
            <div className="alert-stack">
              {encounters.slice(0, 12).map((row) => (
                <div key={row._id} className="card">
                  <strong>{row?.patient?.name || "Child encounter"}</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {row.diagnosis || "Visit record"} • {row.state || "CREATED"}
                  </p>
                  <p className="muted">
                    {row.consultationNotes || "No consultation notes captured yet."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No linked encounter history yet.</div>
          )}
        </div>

        <div className="card doctor-alerts-card">
          <h3>Recent Reports</h3>
          {reports.length ? (
            <div className="alert-stack">
              {reports.slice(0, 12).map((row) => (
                <div key={row._id} className="card">
                  <strong>{row.title || "Clinical Report"}</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {row?.patient?.firstName
                      ? `${row.patient.firstName} ${row.patient.lastName || ""}`.trim()
                      : "Linked child"}
                  </p>
                  <p className="muted">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                  </p>
                  <p className="muted">{row.content ? String(row.content).slice(0, 180) : "No report preview available."}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No linked reports yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
