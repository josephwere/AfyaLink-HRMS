import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../utils/auth";
import {
  listReports,
  listMyReports,
  createReport,
  deleteReport,
} from "../../services/reportsApi";

export default function Reports() {
  const { user } = useAuth();
  const role = user?.role || "";
  const canSeeAll = ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"].includes(role);
  const canCreate = ["DOCTOR"].includes(role);
  const canSeeMine = ["DOCTOR", "PATIENT"].includes(role);

  const [allReports, setAllReports] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [allNextCursor, setAllNextCursor] = useState(null);
  const [myNextCursor, setMyNextCursor] = useState(null);
  const [allHasMore, setAllHasMore] = useState(false);
  const [myHasMore, setMyHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState(canSeeAll ? "all" : "mine");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    patient: "",
  });

  useEffect(() => {
    if (canSeeAll) {
      listReports({ cursorMode: true, limit: 25 })
        .then((data) => {
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          setAllReports(items);
          setAllNextCursor(data?.nextCursor || null);
          setAllHasMore(Boolean(data?.hasMore));
        })
        .catch(() => {
          setAllReports([]);
          setAllNextCursor(null);
          setAllHasMore(false);
        });
    }
    if (canSeeMine) {
      listMyReports({ cursorMode: true, limit: 25 })
        .then((data) => {
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          setMyReports(items);
          setMyNextCursor(data?.nextCursor || null);
          setMyHasMore(Boolean(data?.hasMore));
        })
        .catch(() => {
          setMyReports([]);
          setMyNextCursor(null);
          setMyHasMore(false);
        });
    }
  }, [canSeeAll, canSeeMine]);

  const current = useMemo(
    () => (tab === "all" ? allReports : myReports),
    [tab, allReports, myReports]
  );
  const canLoadMore = tab === "all" ? allHasMore : myHasMore;

  const onCreate = async () => {
    setError("");
    if (!form.title || !form.content) {
      setError("Title and content are required.");
      return;
    }
    try {
      const payload = {
        title: form.title,
        content: form.content,
        ...(form.patient ? { patient: form.patient } : {}),
      };
      const created = await createReport(payload);
      setForm({ title: "", content: "", patient: "" });
      setMyReports((prev) => [created, ...prev]);
    } catch (e) {
      setError(e.message || "Failed to create report");
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteReport(id);
      setAllReports((prev) => prev.filter((r) => r._id !== id));
      setMyReports((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      setError(e.message || "Failed to delete report");
    }
  };

  const onLoadMore = async () => {
    setLoadingMore(true);
    setError("");
    try {
      if (tab === "all") {
        const data = await listReports({
          cursorMode: true,
          limit: 25,
          cursor: allNextCursor,
        });
        const items = Array.isArray(data?.items) ? data.items : [];
        setAllReports((prev) => [...prev, ...items]);
        setAllNextCursor(data?.nextCursor || null);
        setAllHasMore(Boolean(data?.hasMore));
      } else {
        const data = await listMyReports({
          cursorMode: true,
          limit: 25,
          cursor: myNextCursor,
        });
        const items = Array.isArray(data?.items) ? data.items : [];
        setMyReports((prev) => [...prev, ...items]);
        setMyNextCursor(data?.nextCursor || null);
        setMyHasMore(Boolean(data?.hasMore));
      }
    } catch (e) {
      setError(e.message || "Failed to load more reports");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Reports</h2>
          <p className="muted">Clinical and operational reporting.</p>
        </div>
      </div>

      {error && <div className="card">{error}</div>}

      <section className="section">
        <div className="action-list">
          {canSeeAll && (
            <button
              className={`action-pill ${tab === "all" ? "active" : ""}`}
              onClick={() => setTab("all")}
            >
              All Reports
            </button>
          )}
          {canSeeMine && (
            <button
              className={`action-pill ${tab === "mine" ? "active" : ""}`}
              onClick={() => setTab("mine")}
            >
              My Reports
            </button>
          )}
        </div>
      </section>

      {canCreate && (
        <section className="section">
          <h3>Create Report</h3>
          <div className="card form">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <label>Patient ID (optional)</label>
            <input
              value={form.patient}
              onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
            />
            <label>Content</label>
            <textarea
              rows={5}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
            <button className="btn-primary" onClick={onCreate}>
              Create Report
            </button>
          </div>
        </section>
      )}

      <section className="section">
        <h3>{tab === "all" ? "All Reports" : "My Reports"}</h3>
        <div className="card">
          {current.length === 0 ? (
            <div className="muted">No reports found.</div>
          ) : (
            <div className="report-list">
              {current.map((r) => (
                <div key={r._id} className="report-item">
                  <div>
                    <div className="report-title">{r.title || "Untitled"}</div>
                    <div className="muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                    </div>
                    {r.content && (
                      <div className="report-content">
                        {String(r.content).slice(0, 200)}
                      </div>
                    )}
                  </div>
                  {canSeeAll && (
                    <button
                      className="btn-secondary"
                      onClick={() => onDelete(r._id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canLoadMore && (
            <div style={{ marginTop: 12 }}>
              <button
                className="btn-secondary"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
