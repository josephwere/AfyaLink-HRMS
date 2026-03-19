import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAiAdminLogs } from "../services/aiAdminApi";
import { useAuth } from "../utils/auth";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeList(values = []) {
  return values.map((value) => String(value || "").toLowerCase()).filter(Boolean);
}

export default function AIAutofillAuditSummary({
  title = "AI Autofill Review Summary",
  subtitle = "Recent draft/apply activity for this workflow.",
  templateIds = [],
  routeIncludes = [],
  limit = 40,
}) {
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const canReview = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  const hospitalKey = String(user?.hospitalId || user?.hospital || "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const normalizedTemplateIds = useMemo(() => normalizeList(templateIds), [templateIds]);
  const normalizedRouteIncludes = useMemo(() => normalizeList(routeIncludes), [routeIncludes]);

  useEffect(() => {
    if (!canReview) return;
    let mounted = true;
    setLoading(true);
    setMsg("");
    listAiAdminLogs({
      actions: ["AI_ASSISTANT_AUTOFILL_DRAFTED", "AI_ASSISTANT_AUTOFILL_APPLIED"],
      hospitalKey,
      limit,
    })
      .then((data) => {
        if (!mounted) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((err) => {
        if (!mounted) return;
        setItems([]);
        setMsg(err?.message || "Failed to load AI autofill review summary.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [canReview, hospitalKey, limit]);

  const scopedItems = useMemo(() => {
    return items.filter((row) => {
      const templateId = String(row?.metadata?.templateId || "").toLowerCase();
      const route = String(row?.route || "").toLowerCase();
      const matchesTemplate =
        !normalizedTemplateIds.length || normalizedTemplateIds.includes(templateId);
      const matchesRoute =
        !normalizedRouteIncludes.length ||
        normalizedRouteIncludes.some((segment) => route.includes(segment));
      return matchesTemplate || matchesRoute;
    });
  }, [items, normalizedRouteIncludes, normalizedTemplateIds]);

  const stats = useMemo(() => {
    const drafted = scopedItems.filter((row) => row.action === "AI_ASSISTANT_AUTOFILL_DRAFTED").length;
    const applied = scopedItems.filter((row) => row.action === "AI_ASSISTANT_AUTOFILL_APPLIED").length;
    const queuedFields = scopedItems.reduce(
      (sum, row) => sum + safeArray(row?.metadata?.items).filter((item) => item?.status === "queued").length,
      0
    );
    const appliedFields = scopedItems.reduce(
      (sum, row) => sum + safeArray(row?.metadata?.items).filter((item) => item?.status === "applied").length,
      0
    );
    return { drafted, applied, queuedFields, appliedFields };
  }, [scopedItems]);

  if (!canReview) return null;

  return (
    <section className="section">
      <div className="card premium-card">
        <div className="card-header-actions">
          <div>
            <h3>{title}</h3>
            <p className="muted">{subtitle}</p>
          </div>
          <Link to="/admin/ai-autofill-audit" className="btn-secondary">
            Open Full Audit
          </Link>
        </div>

        {msg ? <div className="card">{msg}</div> : null}
        {loading ? <div className="muted">Loading AI autofill summary...</div> : null}

        {!loading ? (
          <>
            <div className="grid info-grid" style={{ marginBottom: 12 }}>
              <div className="card stat">
                <div className="card-title">Draft Events</div>
                <div className="card-value">{stats.drafted}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Apply Events</div>
                <div className="card-value">{stats.applied}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Queued Fields</div>
                <div className="card-value">{stats.queuedFields}</div>
              </div>
              <div className="card stat">
                <div className="card-title">Applied Fields</div>
                <div className="card-value">{stats.appliedFields}</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Template</th>
                    <th>Items</th>
                    <th>Sources</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedItems.slice(0, 6).map((row) => (
                    <tr key={row.id}>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                      <td>{row.action === "AI_ASSISTANT_AUTOFILL_APPLIED" ? "Applied" : "Drafted"}</td>
                      <td>
                        {row.metadata?.templateTitle || row.metadata?.templateId || "—"}
                        <div className="muted">{row.route || "—"}</div>
                      </td>
                      <td>{safeArray(row.metadata?.items).length}</td>
                      <td>{safeArray(row.metadata?.sourceKinds).join(", ") || "—"}</td>
                      <td>{row.summary || "—"}</td>
                    </tr>
                  ))}
                  {!scopedItems.length ? (
                    <tr>
                      <td colSpan={6}>No AI autofill activity has been captured for this workflow yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
