import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getDoctorDashboard } from "../../services/dashboardApi";
import apiFetch from "../../utils/apiFetch";
import { runBurnoutScore } from "../../services/mlApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [burnout, setBurnout] = useState(null);
  const [burnoutTrend, setBurnoutTrend] = useState([]);
  const [resolvingEncounterId, setResolvingEncounterId] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const burnoutStatus = (score) => {
    const n = Number(score || 0);
    if (n >= 75) return "risk";
    if (n >= 45) return "warn";
    return "good";
  };
  const badgeFromStatus = (s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK");

  const loadBurnout = async () => {
    try {
      const r = await runBurnoutScore({
        hoursPerWeek: 56,
        nightShifts: 7,
        consecutiveDays: 7,
        overtimeHours: 14,
        leaveBalanceDays: 6,
        incidentsIn30d: 1,
      });
      setBurnout(r || null);
      setBurnoutTrend((prev) => [...prev, Number(r?.score || 0)].slice(-12));
    } catch {
      setBurnout(null);
    }
  };

  useEffect(() => {
    const loadEncounterSnapshots = async (appointmentRows) => {
      const patientIds = [...new Set(
        (Array.isArray(appointmentRows) ? appointmentRows : [])
          .map((item) => String(item?.patient?._id || item?.patient || ""))
          .filter(Boolean)
      )];
      if (!patientIds.length) {
        setEncounterByPatient({});
        return;
      }
      const pairs = await Promise.all(
        patientIds.map(async (patientId) => {
          try {
            const rows = await apiFetch(`/api/encounters?patientId=${encodeURIComponent(patientId)}&limit=1`);
            const items = Array.isArray(rows) ? rows : [];
            return [patientId, items[0] || null];
          } catch {
            return [patientId, null];
          }
        })
      );
      setEncounterByPatient(Object.fromEntries(pairs));
    };

    getDoctorDashboard()
      .then((res) => setData(res))
      .catch(() => setData(null));

    apiFetch("/api/appointments?limit=8&cursorMode=1")
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        setAppointments(rows);
        loadEncounterSnapshots(rows);
      })
      .catch(() => {
        setAppointments([]);
        setEncounterByPatient({});
      });

    apiFetch("/api/notifications?limit=8")
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setAlerts(items.slice(0, 8));
      })
      .catch(() => setAlerts([]));

    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });

    if (user?.id) {
      apiFetch(`/api/appointments/doctors/${user.id}/availability`)
        .then((res) => setAvailability(Array.isArray(res?.items) ? res.items : []))
        .catch(() => setAvailability([]));
    }

    loadBurnout();
    const timer = setInterval(loadBurnout, 45000);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(
    () => [
      { title: "Today’s Appointments", value: data?.appointmentsToday ?? "—" },
      { title: "Inpatients Assigned", value: data?.activeEncounters ?? "—" },
      { title: "Surgeries Scheduled", value: data?.upcomingAppointments ?? "—" },
      { title: "Pending Lab Results", value: data?.pendingLabResults ?? "—" },
      {
        title: "Consultation Status",
        value: (() => {
          const today = availability.find((row) => Number(row.dayOfWeek) === new Date().getDay());
          if (!today) return "Default";
          if (today.consultationAvailable === false) return "Closed";
          if (today.isAvailable === false) return "Bookings Off";
          return "Open";
        })(),
      },
      { title: "License Expiry (Days)", value: data?.licenseExpiryDays ?? "—" },
    ],
    [data, availability]
  );

  const firstMissingRequirement = (encounter) => {
    const items = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements
      : [];
    return items[0] || "";
  };

  const closeoutLabel = (encounter) => {
    if (!encounter?._id) return "";
    if (encounter?.closeout?.canClose) return translateText("Ready to close");
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Pending: ${missing}` : translateText("Requirements pending");
  };
  const escalationLabel = (encounter) => {
    if (!encounter?.escalationSummary?.count || encounter?.escalationSummary?.openCount === 0) return "";
    return encounter.escalationSummary.unreadMine > 0 ? translateText("Nurse escalation") : translateText("Escalation open");
  };

  const transferStats = useMemo(() => {
    const pending = transfers.filter((t) => t.status === "Pending").length;
    const approved = transfers.filter((t) => t.status === "Approved").length;
    const completed = transfers.filter((t) => t.status === "Completed").length;
    return { pending, approved, completed, total: transfers.length };
  }, [transfers]);
  const openDoctorSummary = (title) => {
    switch (title) {
      case "Today’s Appointments":
        navigate("/doctor/schedule");
        break;
      case "Inpatients Assigned":
        navigate("/doctor/ward-board");
        break;
      case "Surgeries Scheduled":
        navigate("/doctor/surgery");
        break;
      case "Pending Lab Results":
        navigate("/doctor/lab-results");
        break;
      case "Consultation Status":
      case "License Expiry (Days)":
        navigate("/doctor/settings");
        break;
      default:
        break;
    }
  };

  const resolveEscalation = async (encounter, patientKey) => {
    if (!encounter?._id) return;
    try {
      setResolvingEncounterId(String(encounter._id));
      await apiFetch(`/api/encounters/${encodeURIComponent(encounter._id)}/nurse-escalation-resolve`, {
        method: "POST",
        body: { note: "Clinician acknowledged dashboard escalation and resumed closeout workflow." },
      });
      navigate(
        `/doctor/opd${patientKey ? `?patientId=${encodeURIComponent(patientKey)}${firstMissingRequirement(encounter) ? `&focus=${encodeURIComponent(firstMissingRequirement(encounter))}` : ""}` : ""}`
      );
    } finally {
      setResolvingEncounterId("");
    }
  };

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>{translateText("Doctor Clinical Workspace")}</h2>
          <p className="muted">{translateText("Welcome")}, Dr. {user?.name || translateText("Clinician")}. {translateText("Keep patient care fast and clear.")}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/patients")}>{translateText("Open Patients")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/opd")}>{translateText("Write Notes")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/prescriptions")}>{translateText("Complete Plan")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/ward-board")}>{translateText("Ward Board")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/escalations")}>{translateText("My Escalations")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/settings")}>{translateText("My Availability")}</button>
        </div>
      </div>

      <section className="section">
        <h3>{translateText("Clinical KPIs")}</h3>
        <div className="grid info-grid">
          {summary.map((s) => (
            <StatCard
              key={s.title}
              title={translateText(s.title)}
              value={typeof s.value === "string" ? translateText(s.value) : s.value}
              onClick={() => openDoctorSummary(s.title)}
            />
          ))}
          <StatCard title={translateText("Open Escalations")} value={data?.escalationSummary?.openCount ?? "—"} onClick={() => navigate("/doctor/escalations")} />
        </div>
      </section>

      <section className="section">
        <h3>AI Wellbeing Signal</h3>
        <div className="grid info-grid">
          <StatCard
            title="Burnout Risk Score"
            value={burnout?.score ?? "—"}
            trend={burnoutTrend}
            subtitle="Auto-refresh 45s"
            status={burnoutStatus(burnout?.score)}
            badge={badgeFromStatus(burnoutStatus(burnout?.score))}
            why={`Score ${burnout?.score ?? 0}; keep below 45 to remain in low-risk band.`}
            onClick={() => navigate("/doctor/leave")}
            onBadgeClick={() => navigate("/doctor/leave")}
          />
          <StatCard title="Risk Band" value={burnout?.band ?? "—"} onClick={() => navigate("/doctor/leave")} />
          <StatCard title="Recommendations" value={Array.isArray(burnout?.recommendations) ? burnout.recommendations.length : "—"} onClick={() => navigate("/doctor/leave")} />
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/clinical-intelligence")}>
            Open Clinical Intelligence
          </button>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Today’s Schedule</h3>
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a._id}>
                    <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td>{a.type || "OPD"}</td>
                    <td>{a.patient?.name || a.patient?.firstName || "-"}</td>
                    <td>{a.status || "Scheduled"}</td>
                    <td>
                      <div className="doctor-actions-row">
                        {(() => {
                          const patientKey = String(a.patient?._id || a.patient || "");
                          const encounter = encounterByPatient[patientKey];
                          if (!encounter) return null;
                          return (
                            <>
                              <button
                                type="button"
                                className="action-pill"
                                onClick={() =>
                                  navigate(
                                    `/doctor/opd${patientKey ? `?patientId=${encodeURIComponent(patientKey)}${firstMissingRequirement(encounter) ? `&focus=${encodeURIComponent(firstMissingRequirement(encounter))}` : ""}` : ""}`
                                  )
                                }
                              >
                                {closeoutLabel(encounter)}
                              </button>
                              {escalationLabel(encounter) ? (
                                <button
                                  type="button"
                                  className="action-pill warning"
                                  onClick={() => resolveEscalation(encounter, patientKey)}
                                >
                                  {resolvingEncounterId === String(encounter._id) ? "Resolving..." : escalationLabel(encounter)}
                                </button>
                              ) : null}
                            </>
                          );
                        })()}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(`/doctor/medical-records${a.patient?._id ? `?patientId=${a.patient._id}` : ""}`)}
                        >
                          Open Record
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const patientKey = String(a.patient?._id || a.patient || "");
                            const encounter = encounterByPatient[patientKey];
                            const missing = firstMissingRequirement(encounter);
                            navigate(`/doctor/opd${patientKey ? `?patientId=${encodeURIComponent(patientKey)}${missing ? `&focus=${encodeURIComponent(missing)}` : ""}` : ""}`);
                          }}
                        >
                          Start Consultation
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="5" className="muted">No appointments</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts Panel</h3>
          <div className="alert-stack">
            {alerts.map((n) => (
              <button type="button" key={n._id} className="verify-banner" onClick={() => navigate("/notifications")}>
                <span>{n.title || "Clinical Alert"}</span>
              </button>
            ))}
            {alerts.length === 0 && <div className="muted">No alerts</div>}
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transferStats.pending}</div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="grid info-grid" style={{ marginTop: 12 }}>
            <StatCard title="Total" value={transferStats.total || "—"} onClick={() => navigate("/doctor/transfers")} />
            <StatCard title="Approved" value={transferStats.approved || 0} onClick={() => navigate("/doctor/transfers")} />
            <StatCard title="Completed" value={transferStats.completed || 0} onClick={() => navigate("/doctor/transfers")} />
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id} style={{ cursor: "pointer" }} onClick={() => navigate("/doctor/transfers")}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/transfers")}>
              Open Transfers
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/doctor/opd")}>
              Create Transfer
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Tips</h3>
          <div className="alert-stack">
            <div className="alert-item">Confirm consent scope before sharing labs or reports.</div>
            <div className="alert-item">Use the handover summary to reduce repeat diagnostics.</div>
            <div className="alert-item">If a transfer is pending over 24h, escalate in the command center.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Ward Escalations</h3>
              <p className="muted">Nurse-raised blockers that still need clinician review.</p>
            </div>
            <div className="action-pill warning">Open: {data?.escalationSummary?.openCount ?? 0}</div>
          </div>
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {(data?.escalationSummary?.items || []).slice(0, 6).map((item) => (
              <div key={item.id} className="card">
                <div className="card-header-actions">
                  <div>
                    <strong>{item.patientName}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.resolvedAt ? "Resolved" : "Needs review"}
                      {item.missingRequirements?.length ? ` • Missing: ${item.missingRequirements.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className={`action-pill${item.resolvedAt ? "" : " warning"}`}>
                    {item.resolvedAt ? "Resolved" : "Open"}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{item.body || item.title}</p>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(item.path || (item.patientId ? `/doctor/opd?patientId=${encodeURIComponent(item.patientId)}` : "/doctor/opd"))}
                  >
                    Open Visit
                  </button>
                </div>
              </div>
            ))}
            {!(data?.escalationSummary?.items || []).length ? (
              <div className="action-pill">No nurse escalations right now.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
