import React, { useEffect, useState } from "react";
import API from "../../utils/api";
import { listPatients } from "../../services/patientApi";
import { useAuth } from "../../utils/auth";

const PATIENTS_QUERY_CACHE_KEY = "patients_query_cache_v1";
const PATIENTS_QUERY_CACHE_TTL_MS = 15 * 60 * 1000;

export default function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheBadge, setCacheBadge] = useState("Live • now");
  const [form, setForm] = useState({ firstName: "", lastName: "", nationalId: "", dob: "" });
  const cacheScope = `${user?.role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;

  const parseList = (data) => ({
    items: Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [],
    nextCursor: data?.nextCursor || null,
    hasMore: Boolean(data?.hasMore),
  });

  const fetchPatients = async () => {
    setLoading(true);
    setMsg("");
    try {
      const data = await listPatients({ cursorMode: true, limit: 25, q: query.trim() || undefined });
      const parsed = parseList(data);
      setPatients(parsed.items);
      setNextCursor(parsed.nextCursor);
      setHasMore(parsed.hasMore);
      setCacheBadge("Live • now");
    } catch (err) {
      setMsg(err?.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PATIENTS_QUERY_CACHE_KEY);
      if (!raw) {
        setCacheBadge("Live • now");
        fetchPatients();
        setCacheReady(true);
        return;
      }
      const all = JSON.parse(raw);
      const cached = all?.[cacheScope];
      if (!cached || typeof cached !== "object") {
        setCacheBadge("Live • now");
        fetchPatients();
        setCacheReady(true);
        return;
      }
      const age = Date.now() - new Date(cached.updatedAt || 0).getTime();
      if (!Number.isFinite(age) || age < 0 || age > PATIENTS_QUERY_CACHE_TTL_MS) {
        setCacheBadge("Live • now");
        fetchPatients();
        setCacheReady(true);
        return;
      }
      const ageMinutes = Math.max(0, Math.floor(age / 60000));
      if (typeof cached.query === "string") setQuery(cached.query);
      if (Array.isArray(cached.patients)) setPatients(cached.patients);
      if (typeof cached.nextCursor === "string" || cached.nextCursor === null) {
        setNextCursor(cached.nextCursor);
      }
      if (typeof cached.hasMore === "boolean") setHasMore(cached.hasMore);
      setCacheBadge(`Cached • ${ageMinutes}m ago`);
    } catch {
      fetchPatients();
    } finally {
      setCacheReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheScope]);

  useEffect(() => {
    if (!cacheReady) return;
    try {
      const raw = localStorage.getItem(PATIENTS_QUERY_CACHE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[cacheScope] = {
        query,
        patients,
        nextCursor,
        hasMore,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(PATIENTS_QUERY_CACHE_KEY, JSON.stringify(all));
    } catch {
      // ignore cache persistence errors
    }
  }, [cacheReady, cacheScope, query, patients, nextCursor, hasMore]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await listPatients({
        cursorMode: true,
        limit: 25,
        q: query.trim() || undefined,
        cursor: nextCursor,
      });
      const parsed = parseList(data);
      setPatients((prev) => [...prev, ...parsed.items]);
      setNextCursor(parsed.nextCursor);
      setHasMore(parsed.hasMore);
    } catch (err) {
      setMsg(err?.message || "Failed to load more patients");
    } finally {
      setLoadingMore(false);
    }
  };

  const create = async () => {
    setMsg("");
    try {
      await API.post("/patients", form);
      await fetchPatients();
      setForm({ firstName: "", lastName: "", nationalId: "", dob: "" });
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to create patient");
    }
  };

  const resetView = async () => {
    try {
      const raw = localStorage.getItem(PATIENTS_QUERY_CACHE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      delete all[cacheScope];
      localStorage.setItem(PATIENTS_QUERY_CACHE_KEY, JSON.stringify(all));
    } catch {
      // ignore cache clear errors
    }

    setQuery("");
    setPatients([]);
    setNextCursor(null);
    setHasMore(false);
    await fetchPatients();
    setCacheBadge("Live • now");
    setMsg("View reset and reloaded from server");
  };

  return (
    <div>
      <h3>Patients</h3>
      {msg && <p className="muted">{msg}</p>}
      <div style={{ marginBottom: 10, display: "flex", gap: 8 }}>
        <input
          placeholder="Search patient by name or national ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={fetchPatients} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
        <button onClick={resetView} disabled={loading}>
          Reset View
        </button>
        <span className="muted">{cacheBadge}</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <input
            placeholder="First"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            placeholder="Last"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <input
            placeholder="National ID"
            value={form.nationalId}
            onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
          />
          <input
            placeholder="DOB"
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
          <button onClick={create}>Create</button>
        </div>
        <div style={{ flex: 2 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p._id}>
                  <td>
                    {p.firstName} {p.lastName}
                  </td>
                  <td>{p.nationalId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore} style={{ marginTop: 8 }}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
