import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { listPatients } from "../../services/patientApi";
import { useAuth } from "../../utils/auth";

const PATIENTS_QUERY_CACHE_KEY = "patients_query_cache_v1";
const PATIENTS_QUERY_CACHE_TTL_MS = 15 * 60 * 1000;

function isMinorDob(dob) {
  if (!dob) return false;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age < 18;
}

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
  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianResults, setGuardianResults] = useState([]);
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [guardianRelationship, setGuardianRelationship] = useState("PARENT");
  const [guardianNotes, setGuardianNotes] = useState("");
  const cacheScope = `${user?.role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;
  const isMinor = isMinorDob(form.dob);

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
      await apiFetch("/api/patients", {
        method: "POST",
        body: {
          ...form,
          ...(isMinor && selectedGuardian
            ? {
                guardianAccountId: selectedGuardian._id,
                guardianRelationship,
                guardianNotes,
              }
            : {}),
        },
      });
      await fetchPatients();
      setForm({ firstName: "", lastName: "", nationalId: "", dob: "" });
      setGuardianQuery("");
      setGuardianResults([]);
      setSelectedGuardian(null);
      setGuardianRelationship("PARENT");
      setGuardianNotes("");
      setMsg(
        isMinor && selectedGuardian
          ? "Patient created and linked to the selected parent account."
          : "Patient created."
      );
    } catch (err) {
      setMsg(err?.message || "Failed to create patient");
    }
  };

  const searchGuardians = async () => {
    if (!guardianQuery.trim()) {
      setMsg("Enter parent email, phone, name, or ID before searching.");
      return;
    }
    setGuardianSearching(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ q: guardianQuery.trim() });
      const data = await apiFetch(`/api/patients/guardians/search?${params.toString()}`);
      setGuardianResults(Array.isArray(data?.items) ? data.items : []);
      if (!(data?.items || []).length) {
        setMsg("No matching parent account found.");
      }
    } catch (err) {
      setGuardianResults([]);
      setMsg(err?.message || "Failed to search parent accounts.");
    } finally {
      setGuardianSearching(false);
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
    <div className="dashboard">
      <h3>Patients</h3>
      {msg && <p className="muted">{msg}</p>}
      <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
        <div className="card form">
          <input
            placeholder="Search patient by name or national ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="welcome-actions">
            <button type="button" className="btn-secondary" onClick={fetchPatients} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
            <button type="button" className="btn-secondary" onClick={resetView} disabled={loading}>
              Reset View
            </button>
          </div>
          <span className="muted">{cacheBadge}</span>

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
          {isMinor ? (
            <>
              <div className="subtle-banner">
                This patient is a minor. Link a parent or guardian account so the child can be monitored from the parent account.
              </div>
              <input
                placeholder="Search parent by name, email, phone, or ID"
                value={guardianQuery}
                onChange={(e) => setGuardianQuery(e.target.value)}
              />
              <div className="welcome-actions">
                <button type="button" className="btn-secondary" onClick={searchGuardians} disabled={guardianSearching}>
                  {guardianSearching ? "Searching..." : "Find Parent Account"}
                </button>
                {selectedGuardian ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedGuardian(null)}
                  >
                    Clear Parent
                  </button>
                ) : null}
              </div>
              <select value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)}>
                <option value="PARENT">Parent</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="CAREGIVER">Caregiver</option>
              </select>
              <input
                placeholder="Guardian note (optional)"
                value={guardianNotes}
                onChange={(e) => setGuardianNotes(e.target.value)}
              />
              {selectedGuardian ? (
                <div className="card">
                  <strong>Linked parent:</strong> {selectedGuardian.name}
                  <div className="muted">{selectedGuardian.email || selectedGuardian.phone || selectedGuardian.nationalIdNumber || "No contact"}</div>
                </div>
              ) : null}
              {guardianResults.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Role</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {guardianResults.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.email || item.phone || item.nationalIdNumber || "-"}</td>
                          <td>{item.role}</td>
                          <td>
                            <button
                              type="button"
                              className={selectedGuardian?._id === item._id ? "btn-secondary" : "btn-primary"}
                              onClick={() => setSelectedGuardian(item)}
                            >
                              {selectedGuardian?._id === item._id ? "Selected" : "Use"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
          <div>
            <button type="button" className="btn-primary" onClick={create}>Create</button>
          </div>
        </div>
        <div className="card">
          <div className="table-wrap">
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
          </div>
          {hasMore && (
            <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore} style={{ marginTop: 8 }}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
