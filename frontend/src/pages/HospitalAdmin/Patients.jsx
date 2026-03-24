import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { listPatients } from "../../services/patientApi";
import { useAuth } from "../../utils/auth";
import { extractDocument } from "../../services/aiExtractionApi";
import { parseParentIdExtraction } from "../../utils/parentIdExtraction";

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
  const [inviteNewGuardian, setInviteNewGuardian] = useState(false);
  const [newGuardian, setNewGuardian] = useState({
    name: "",
    email: "",
    phone: "",
    nationalIdNumber: "",
    nationalIdCountry: "KE",
  });
  const [parentAnchor, setParentAnchor] = useState({
    nationalIdNumber: "",
    nationalIdCountry: "KE",
    displayName: "",
    phone: "",
  });
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState("");
  const parentIdFileInputRef = useRef(null);
  const parentIdCameraInputRef = useRef(null);
  const cacheScope = `${user?.role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;
  const isMinor = isMinorDob(form.dob);

  useEffect(() => {
    if (!selectedGuardian) return;
    setParentAnchor((prev) => ({
      ...prev,
      nationalIdNumber: selectedGuardian.nationalIdNumber || prev.nationalIdNumber || "",
      nationalIdCountry: selectedGuardian.nationalIdCountry || prev.nationalIdCountry || "KE",
      displayName: selectedGuardian.name || prev.displayName || "",
      phone: selectedGuardian.phone || prev.phone || "",
    }));
  }, [selectedGuardian]);

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
    setOcrMsg("");
    if (isMinor && !selectedGuardian && !inviteNewGuardian && !parentAnchor.nationalIdNumber.trim()) {
      setMsg("Add the parent's national ID or link/create a parent account before registering a minor.");
      return;
    }
    if (isMinor && inviteNewGuardian && (!newGuardian.name.trim() || !newGuardian.email.trim())) {
      setMsg("Parent full name and email are required when creating a new parent account.");
      return;
    }
    try {
      const resolvedParentNationalIdNumber =
        selectedGuardian?.nationalIdNumber ||
        newGuardian.nationalIdNumber ||
        parentAnchor.nationalIdNumber;
      const resolvedParentNationalIdCountry =
        selectedGuardian?.nationalIdCountry ||
        newGuardian.nationalIdCountry ||
        parentAnchor.nationalIdCountry;
      const resolvedParentDisplayName =
        selectedGuardian?.name ||
        newGuardian.name ||
        parentAnchor.displayName;
      const resolvedParentPhone =
        selectedGuardian?.phone ||
        newGuardian.phone ||
        parentAnchor.phone;

      const res = await apiFetch("/api/patients", {
        method: "POST",
        body: {
          ...form,
          ...(isMinor
            ? {
                guardianRelationship,
                guardianNotes,
                guardianNationalIdNumber: resolvedParentNationalIdNumber,
                guardianNationalIdCountry: resolvedParentNationalIdCountry,
                guardianDisplayName: resolvedParentDisplayName,
                guardianPhone: resolvedParentPhone,
              }
            : {}),
          ...(isMinor && selectedGuardian
            ? {
                guardianAccountId: selectedGuardian._id,
              }
            : {}),
          ...(isMinor && inviteNewGuardian && !selectedGuardian
            ? {
                createGuardianAccount: {
                  name: newGuardian.name,
                  email: newGuardian.email,
                  phone: newGuardian.phone,
                  nationalIdNumber: newGuardian.nationalIdNumber,
                  nationalIdCountry: newGuardian.nationalIdCountry,
                },
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
      setInviteNewGuardian(false);
      setNewGuardian({
        name: "",
        email: "",
        phone: "",
        nationalIdNumber: "",
        nationalIdCountry: "KE",
      });
      setParentAnchor({
        nationalIdNumber: "",
        nationalIdCountry: "KE",
        displayName: "",
        phone: "",
      });
      setMsg(
        isMinor && selectedGuardian
          ? "Patient created and linked to the selected parent account."
          : res?.guardianInviteIssued
            ? "Patient created. Parent account was created and an invite email was sent."
            : isMinor && resolvedParentNationalIdNumber
              ? "Patient created and anchored under the parent's national ID for family monitoring."
            : "Patient created."
      );
    } catch (err) {
      setMsg(err?.message || "Failed to create patient");
    }
  };

  const applyScannedParentIdentity = (parsed) => {
    setParentAnchor((prev) => ({
      ...prev,
      nationalIdNumber: parsed.nationalIdNumber || prev.nationalIdNumber,
      nationalIdCountry: parsed.nationalIdCountry || prev.nationalIdCountry || "KE",
      displayName: parsed.displayName || prev.displayName,
      phone: parsed.phone || prev.phone,
    }));
    setNewGuardian((prev) => ({
      ...prev,
      nationalIdNumber: parsed.nationalIdNumber || prev.nationalIdNumber,
      nationalIdCountry: parsed.nationalIdCountry || prev.nationalIdCountry || "KE",
      name: prev.name || parsed.displayName || "",
      phone: prev.phone || parsed.phone || "",
    }));
  };

  const runParentIdExtraction = async (file) => {
    if (!file) return;
    setOcrBusy(true);
    setOcrMsg("");
    setMsg("");
    try {
      const out = await extractDocument(file);
      const parsed = parseParentIdExtraction(out?.extraction || {});
      applyScannedParentIdentity(parsed);
      if (parsed.nationalIdNumber) {
        setOcrMsg("Parent ID scanned successfully. Review the extracted details before creating the child record.");
      } else {
        setOcrMsg("Scan completed, but the parent national ID was not confidently detected. Review and complete the fields manually.");
      }
    } catch (err) {
      setOcrMsg(err?.message || "Failed to scan parent ID. Check AI extraction access and try again.");
    } finally {
      setOcrBusy(false);
      if (parentIdFileInputRef.current) parentIdFileInputRef.current.value = "";
      if (parentIdCameraInputRef.current) parentIdCameraInputRef.current.value = "";
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
                This patient is a minor. Use any of the supported flows: link an existing parent account, create and invite a new parent, or register the child under the parent's national ID if only the ID card is available.
              </div>
              <input
                placeholder="Search parent by name, email, phone, or national ID"
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
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setInviteNewGuardian((prev) => !prev);
                    if (selectedGuardian) setSelectedGuardian(null);
                  }}
                >
                  {inviteNewGuardian ? "Use Existing Parent" : "Create & Invite Parent"}
                </button>
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
              <div className="card form">
                <strong>Parent identity anchor</strong>
                <span className="muted">
                  If the parent does not yet have an AfyaLink account, staff can still register the child under the parent's national ID so the family record follows that ID later.
                </span>
                <div className="welcome-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => parentIdFileInputRef.current?.click()}
                    disabled={ocrBusy}
                  >
                    {ocrBusy ? "Scanning..." : "Upload Parent ID"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => parentIdCameraInputRef.current?.click()}
                    disabled={ocrBusy}
                  >
                    {ocrBusy ? "Scanning..." : "Take Photo"}
                  </button>
                </div>
                <input
                  ref={parentIdFileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp"
                  style={{ display: "none" }}
                  onChange={(e) => runParentIdExtraction(e.target.files?.[0] || null)}
                />
                <input
                  ref={parentIdCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => runParentIdExtraction(e.target.files?.[0] || null)}
                />
                {ocrMsg ? <span className="muted">{ocrMsg}</span> : null}
                <input
                  placeholder="Parent national ID"
                  value={parentAnchor.nationalIdNumber}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, nationalIdNumber: e.target.value }))
                  }
                />
                <input
                  placeholder="Parent national ID country (e.g. KE)"
                  value={parentAnchor.nationalIdCountry}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, nationalIdCountry: e.target.value.toUpperCase() }))
                  }
                />
                <input
                  placeholder="Parent display name (optional)"
                  value={parentAnchor.displayName}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                />
                <input
                  placeholder="Parent phone (optional)"
                  value={parentAnchor.phone}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              {inviteNewGuardian ? (
                <div className="card form">
                  <strong>Create parent account and send invite</strong>
                  <input
                    placeholder="Parent full name"
                    value={newGuardian.name}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    placeholder="Parent email"
                    value={newGuardian.email}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <input
                    placeholder="Parent phone (optional)"
                    value={newGuardian.phone}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  <input
                    placeholder="Parent national ID"
                    value={newGuardian.nationalIdNumber}
                    onChange={(e) =>
                      setNewGuardian((prev) => ({ ...prev, nationalIdNumber: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Parent national ID country (e.g. KE)"
                    value={newGuardian.nationalIdCountry}
                    onChange={(e) =>
                      setNewGuardian((prev) => ({ ...prev, nationalIdCountry: e.target.value.toUpperCase() }))
                    }
                  />
                  <span className="muted">
                    A secure set-password email will be sent to the parent after the child record is created.
                  </span>
                </div>
              ) : null}
              {selectedGuardian ? (
                <div className="card">
                  <strong>Linked parent:</strong> {selectedGuardian.name}
                  <div className="muted">{selectedGuardian.email || selectedGuardian.phone || selectedGuardian.nationalIdNumber || "No contact"}</div>
                  {selectedGuardian.nationalIdNumber ? (
                    <div className="muted">
                      Parent national ID: {selectedGuardian.nationalIdNumber}
                      {selectedGuardian.nationalIdCountry ? ` (${selectedGuardian.nationalIdCountry})` : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {guardianResults.length && !inviteNewGuardian ? (
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
