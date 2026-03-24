import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getMyFamilyTimeline } from "../../services/patientApi";
import PatientLanguageBar from "../../components/PatientLanguageBar";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";

function formatWhen(value) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return date.toLocaleString();
}

export default function FamilyTimeline() {
  const navigate = useNavigate();
  const { t } = usePatientLanguage();
  const [data, setData] = useState({ members: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [activeMember, setActiveMember] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    getMyFamilyTimeline({ limit: 140 })
      .then((res) => {
        setData({
          members: Array.isArray(res?.members) ? res.members : [],
          items: Array.isArray(res?.items) ? res.items : [],
        });
        setMsg("");
      })
      .catch((err) => {
        setData({ members: [], items: [] });
        setMsg(err?.message || "Failed to load family timeline.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    if (activeMember === "ALL") return data.items;
    return data.items.filter((item) => String(item.patientId) === String(activeMember));
  }, [data.items, activeMember]);

  const totals = useMemo(() => {
    const countsByType = filteredItems.reduce((acc, item) => {
      const key = String(item.type || "OTHER").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      members: data.members.length,
      events: filteredItems.length,
      clinical: (countsByType.ENCOUNTER || 0) + (countsByType.REPORT || 0) + (countsByType.PRESCRIPTION || 0),
      finance: (countsByType.CLAIM || 0) + (countsByType.INVOICE || 0),
    };
  }, [data.members.length, filteredItems]);

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>{t("familyTimelineTitle", "Family Timeline")}</h2>
          <p className="muted">
            {t(
              "familyTimelineSubtitle",
              "One longitudinal care stream across the parent account, children, spouse, dependents, claims, visits, transfers, and matched vaccine events."
            )}
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/patient/family-records")}>
            {t("familyRecords", "Family Records")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/billing")}>
            {t("billing", "Billing")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>
            {t("familySettings", "Family Settings")}
          </button>
        </div>
      </div>

      <PatientLanguageBar
        title={t("familyTimelineTitle", "Family Timeline")}
        subtitle={t(
          "familyTimelineSubtitle",
          "One longitudinal care stream across the parent account, children, spouse, dependents, claims, visits, transfers, and matched vaccine events."
        )}
      />

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title={t("familyMembers", "Family Members")} value={totals.members} onClick={() => window.scrollTo({ top: 480, behavior: "smooth" })} />
          <StatCard title={t("timelineEvents", "Timeline Events")} value={totals.events} onClick={() => window.scrollTo({ top: 920, behavior: "smooth" })} />
          <StatCard title={t("clinicalEvents", "Clinical Events")} value={totals.clinical} onClick={() => window.scrollTo({ top: 920, behavior: "smooth" })} />
          <StatCard title={t("financialEvents", "Financial Events")} value={totals.finance} onClick={() => window.scrollTo({ top: 920, behavior: "smooth" })} />
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>{t("familyGraph", "Family Graph")}</h3>
              <p className="muted">
                {t("familyGraphSubtitle", "Filter the timeline by one person or keep the whole family stream in view.")}
              </p>
            </div>
            <div className="action-pill">{loading ? "Refreshing" : `${filteredItems.length} visible events`}</div>
          </div>

          <div className="family-member-grid" style={{ marginTop: 14 }}>
            <button
              type="button"
              className={`family-member-chip ${activeMember === "ALL" ? "is-active" : ""}`}
              onClick={() => setActiveMember("ALL")}
            >
              <strong>{t("wholeFamily", "Whole Family")}</strong>
              <span>{t("everything", "Everything")}</span>
            </button>
            {data.members.map((member) => (
              <button
                type="button"
                key={member.patientId}
                className={`family-member-chip ${String(activeMember) === String(member.patientId) ? "is-active" : ""}`}
                onClick={() => setActiveMember(String(member.patientId))}
              >
                <strong>{member.name}</strong>
                <span>
                  {member.relationship || member.memberType || "Family"} • {member.hospitalName || "No hospital"}
                </span>
                {member.redacted ? <small>{t("teenSharedAccess", "Teen shared access")}</small> : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>{t("longitudinalTimeline", "Longitudinal Timeline")}</h3>
              <p className="muted">
                {t(
                  "longitudinalTimelineSubtitle",
                  "This is the combined family event stream. Teen shared-access rules still redact detailed clinical content where required."
                )}
              </p>
            </div>
            <div className="action-pill">{loading ? "Loading…" : `${filteredItems.length} events`}</div>
          </div>

          {loading ? (
            <div className="muted" style={{ marginTop: 14 }}>Loading family timeline…</div>
          ) : filteredItems.length ? (
            <div className="family-timeline-list">
              {filteredItems.map((item, index) => (
                <article key={`${item.type}-${item.patientId}-${item.metadata?.appointmentId || item.metadata?.encounterId || item.metadata?.reportId || item.metadata?.prescriptionId || item.metadata?.claimId || item.metadata?.invoiceId || item.metadata?.transferId || item.metadata?.vaccinationId || index}`} className="family-timeline-item">
                  <div className="family-timeline-dot" aria-hidden="true" />
                  <div className="family-timeline-body">
                    <div className="card-header-actions">
                      <div>
                        <div className="family-timeline-meta">
                          <span className="action-pill">{item.type}</span>
                          <span className="muted">{item.patientName}</span>
                          {item.relationship ? <span className="muted">{item.relationship}</span> : null}
                        </div>
                        <h4>{item.title}</h4>
                      </div>
                      <div className="family-timeline-time">{formatWhen(item.occurredAt)}</div>
                    </div>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {item.detail}
                    </p>
                    <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                      {item.status ? <span className="action-pill">{item.status}</span> : null}
                      {item.hospitalName ? <span className="action-pill">{item.hospitalName}</span> : null}
                      {item.redacted ? <span className="action-pill">{t("teenSharedAccess", "Teen shared access")}</span> : null}
                      <button type="button" className="btn-secondary" onClick={() => navigate(item.path || "/patient/family-records")}>
                        {t("openSourceView", "Open Source View")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 14 }}>
              {t("noFamilyTimeline", "No family timeline activity yet.")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
