import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import {
  listPatients,
  requestFamilyAnchorApprovalOtp,
  verifyFamilyAnchorApprovalOtp,
} from "../../services/patientApi";
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
  const [familyAnchorEnabled, setFamilyAnchorEnabled] = useState(false);
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
  const [ocrPreview, setOcrPreview] = useState(null);
  const [familyApprovalBusy, setFamilyApprovalBusy] = useState(false);
  const [familyApprovalMsg, setFamilyApprovalMsg] = useState("");
  const [familyApprovalOtp, setFamilyApprovalOtp] = useState("");
  const [familyApprovalStatus, setFamilyApprovalStatus] = useState("IDLE");
  const parentIdFileInputRef = useRef(null);
  const parentIdCameraInputRef = useRef(null);
  const cacheScope = `${user?.role || "UNKNOWN"}:${user?._id || user?.id || user?.email || "anon"}`;
  const isMinor = isMinorDob(form.dob);
  const needsFamilyAnchor = isMinor || familyAnchorEnabled;

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

  useEffect(() => {
    if (isMinor) {
      setFamilyAnchorEnabled(true);
      return;
    }
    setFamilyApprovalStatus("IDLE");
    setFamilyApprovalOtp("");
    setFamilyApprovalMsg("");
  }, [isMinor]);

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
    if (needsFamilyAnchor && !selectedGuardian && !inviteNewGuardian && !parentAnchor.nationalIdNumber.trim()) {
      setMsg("Add the family anchor national ID or link/create the family anchor account before saving this patient.");
      return;
    }
    if (needsFamilyAnchor && !selectedGuardian && !inviteNewGuardian && familyApprovalStatus !== "APPROVED") {
      setMsg("Verify the family anchor OTP before saving a patient under a standalone national ID.");
      return;
    }
    if (needsFamilyAnchor && inviteNewGuardian && (!newGuardian.name.trim() || !newGuardian.email.trim())) {
      setMsg("Family anchor full name and email are required when creating a new account.");
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
          ...(needsFamilyAnchor
            ? {
                useFamilyAnchor: !isMinor,
                guardianRelationship,
                guardianNotes,
                guardianNationalIdNumber: resolvedParentNationalIdNumber,
                guardianNationalIdCountry: resolvedParentNationalIdCountry,
                guardianDisplayName: resolvedParentDisplayName,
                guardianPhone: resolvedParentPhone,
              }
            : {}),
          ...(needsFamilyAnchor && selectedGuardian
            ? {
                guardianAccountId: selectedGuardian._id,
              }
            : {}),
          ...(needsFamilyAnchor && inviteNewGuardian && !selectedGuardian
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
      setFamilyAnchorEnabled(false);
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
      setOcrPreview(null);
      setFamilyApprovalOtp("");
      setFamilyApprovalMsg("");
      setFamilyApprovalStatus("IDLE");
      setMsg(
        needsFamilyAnchor && selectedGuardian
          ? "Patient created and linked to the selected family anchor account."
          : res?.guardianInviteIssued
            ? "Patient created. Family anchor account was created and an invite email was sent."
            : needsFamilyAnchor && resolvedParentNationalIdNumber
              ? "Patient created and anchored under the approved family national ID."
            : "Patient created."
      );
    } catch (err) {
      setMsg(err?.message || "Failed to create patient");
    }
  };

  const applyScannedParentIdentity = (parsed) => {
    setParentAnchor((prev) => ({
      ...prev,
      nationalIdNumber: parsed.preview?.nationalIdNumber || parsed.nationalIdNumber || prev.nationalIdNumber,
      nationalIdCountry: parsed.preview?.nationalIdCountry || parsed.nationalIdCountry || prev.nationalIdCountry || "KE",
      displayName: parsed.preview?.displayName || parsed.displayName || prev.displayName,
      phone: parsed.preview?.phone || parsed.phone || prev.phone,
    }));
    setNewGuardian((prev) => ({
      ...prev,
      nationalIdNumber: parsed.preview?.nationalIdNumber || parsed.nationalIdNumber || prev.nationalIdNumber,
      nationalIdCountry: parsed.preview?.nationalIdCountry || parsed.nationalIdCountry || prev.nationalIdCountry || "KE",
      name: prev.name || parsed.preview?.displayName || parsed.displayName || "",
      phone: prev.phone || parsed.preview?.phone || parsed.phone || "",
    }));
  };

  const runParentIdExtraction = async (file) => {
    if (!file) return;
    setOcrBusy(true);
    setOcrMsg("");
    setMsg("");
    setOcrPreview(null);
    try {
      const out = await extractDocument(file);
      const parsed = parseParentIdExtraction(out?.extraction || {});
      setOcrPreview(parsed);
      if (parsed.preview?.nationalIdNumber || parsed.nationalIdNumber) {
        setOcrMsg("Parent ID scanned. Review the preview and confirm before saving this family anchor.");
      } else {
        setOcrMsg("Scan completed, but the family national ID was not confidently detected. Review and complete the fields manually.");
      }
    } catch (err) {
      setOcrMsg(err?.message || "Failed to scan family anchor ID. Check AI extraction access and try again.");
    } finally {
      setOcrBusy(false);
      if (parentIdFileInputRef.current) parentIdFileInputRef.current.value = "";
      if (parentIdCameraInputRef.current) parentIdCameraInputRef.current.value = "";
    }
  };

  const requestFamilyOtp = async () => {
    if (!parentAnchor.nationalIdNumber.trim() || !parentAnchor.phone.trim()) {
      setFamilyApprovalMsg("Enter the family anchor national ID and phone before requesting OTP.");
      return;
    }
    setFamilyApprovalBusy(true);
    setFamilyApprovalMsg("");
    try {
      const data = await requestFamilyAnchorApprovalOtp({
        nationalIdNumber: parentAnchor.nationalIdNumber,
        nationalIdCountry: parentAnchor.nationalIdCountry,
        phone: parentAnchor.phone,
        displayName: parentAnchor.displayName,
        notes: guardianNotes,
      });
      setFamilyApprovalStatus("PENDING");
      setFamilyApprovalMsg(data?.message || "OTP sent to the family anchor phone number.");
    } catch (err) {
      setFamilyApprovalMsg(err?.message || "Failed to request family approval OTP.");
    } finally {
      setFamilyApprovalBusy(false);
    }
  };

  const verifyFamilyOtp = async () => {
    if (!familyApprovalOtp.trim()) {
      setFamilyApprovalMsg("Enter the OTP sent to the family anchor phone.");
      return;
    }
    setFamilyApprovalBusy(true);
    setFamilyApprovalMsg("");
    try {
      const data = await verifyFamilyAnchorApprovalOtp({
        nationalIdNumber: parentAnchor.nationalIdNumber,
        nationalIdCountry: parentAnchor.nationalIdCountry,
        phone: parentAnchor.phone,
        displayName: parentAnchor.displayName,
        otp: familyApprovalOtp,
      });
      setFamilyApprovalStatus("APPROVED");
      setFamilyApprovalMsg(data?.message || "Family anchor approved.");
    } catch (err) {
      setFamilyApprovalMsg(err?.message || "Failed to verify family approval OTP.");
    } finally {
      setFamilyApprovalBusy(false);
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
          {!isMinor ? (
            <label className="profile-row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={familyAnchorEnabled}
                onChange={(e) => setFamilyAnchorEnabled(e.target.checked)}
              />
              Register this patient under an approved family anchor ID
            </label>
          ) : null}
          {needsFamilyAnchor ? (
            <>
              <div className="subtle-banner">
                {isMinor
                  ? "This patient is a minor. Use any of the supported flows: link an existing parent account, create and invite a new parent, or register the child under the parent's national ID if only the ID card is available."
                  : "This patient will be attached to a family anchor so one approved national ID can serve the spouse and children under the same household record."}
              </div>
              <input
                placeholder="Search family anchor by name, email, phone, or national ID"
                value={guardianQuery}
                onChange={(e) => setGuardianQuery(e.target.value)}
              />
              <div className="welcome-actions">
                <button type="button" className="btn-secondary" onClick={searchGuardians} disabled={guardianSearching}>
                  {guardianSearching ? "Searching..." : "Find Family Anchor Account"}
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
                  {inviteNewGuardian ? "Use Existing Account" : "Create & Invite Anchor"}
                </button>
              </div>
              <select value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)}>
                <option value="PARENT">Parent / Father</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="CAREGIVER">Caregiver</option>
                <option value="SPOUSE">Spouse</option>
                <option value="DEPENDENT">Dependent</option>
              </select>
              <input
                placeholder="Family anchor note (optional)"
                value={guardianNotes}
                onChange={(e) => setGuardianNotes(e.target.value)}
              />
              <div className="card form">
                <strong>Family national ID anchor</strong>
                <span className="muted">
                  If the father or primary family anchor does not yet have an AfyaLink account, staff can still register the family under that national ID. OTP approval sent to the anchor phone makes the linkage legally safer and reusable across spouse and children.
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
                {ocrPreview ? (
                  <div className="card premium-card">
                    <strong>OCR preview</strong>
                    <div className="panel-grid" style={{ marginTop: 10 }}>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>National ID</span>
                          <span className="action-pill">{ocrPreview.confidence?.nationalIdNumber || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.nationalIdNumber || "Not detected"}</div>
                      </div>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>Country</span>
                          <span className="action-pill">{ocrPreview.confidence?.nationalIdCountry || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.nationalIdCountry || "Not detected"}</div>
                      </div>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>Name</span>
                          <span className="action-pill">{ocrPreview.confidence?.displayName || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.displayName || "Not detected"}</div>
                      </div>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>Phone</span>
                          <span className="action-pill">{ocrPreview.confidence?.phone || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.phone || "Not detected"}</div>
                      </div>
                    </div>
                    <div className="welcome-actions" style={{ marginTop: 10 }}>
                      <button type="button" className="btn-primary" onClick={() => applyScannedParentIdentity(ocrPreview)}>
                        Use Scanned Values
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setOcrPreview(null)}>
                        Clear Preview
                      </button>
                    </div>
                    {ocrPreview.sourceSummary ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        {ocrPreview.sourceSummary}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <input
                  placeholder="Family anchor national ID"
                  value={parentAnchor.nationalIdNumber}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, nationalIdNumber: e.target.value }))
                  }
                />
                <input
                  placeholder="Family anchor ID country (e.g. KE)"
                  value={parentAnchor.nationalIdCountry}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, nationalIdCountry: e.target.value.toUpperCase() }))
                  }
                />
                <input
                  placeholder="Family anchor holder name (optional)"
                  value={parentAnchor.displayName}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                />
                <input
                  placeholder="Family anchor phone for OTP approval"
                  value={parentAnchor.phone}
                  onChange={(e) =>
                    setParentAnchor((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
                <div className="welcome-actions">
                  <button type="button" className="btn-secondary" onClick={requestFamilyOtp} disabled={familyApprovalBusy}>
                    {familyApprovalBusy ? "Sending..." : "Send Family OTP"}
                  </button>
                  <input
                    placeholder="Enter OTP"
                    value={familyApprovalOtp}
                    onChange={(e) => setFamilyApprovalOtp(e.target.value)}
                  />
                  <button type="button" className="btn-primary" onClick={verifyFamilyOtp} disabled={familyApprovalBusy}>
                    {familyApprovalBusy ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
                {familyApprovalStatus === "APPROVED" ? (
                  <div className="action-pill ok">Family anchor approved</div>
                ) : null}
                {familyApprovalMsg ? <span className="muted">{familyApprovalMsg}</span> : null}
              </div>
              {inviteNewGuardian ? (
                <div className="card form">
                  <strong>Create family anchor account and send invite</strong>
                  <input
                    placeholder="Anchor full name"
                    value={newGuardian.name}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor email"
                    value={newGuardian.email}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor phone"
                    value={newGuardian.phone}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor national ID"
                    value={newGuardian.nationalIdNumber}
                    onChange={(e) =>
                      setNewGuardian((prev) => ({ ...prev, nationalIdNumber: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Anchor national ID country (e.g. KE)"
                    value={newGuardian.nationalIdCountry}
                    onChange={(e) =>
                      setNewGuardian((prev) => ({ ...prev, nationalIdCountry: e.target.value.toUpperCase() }))
                    }
                  />
                  <span className="muted">
                    A secure set-password email will be sent to the family anchor after the patient record is created.
                  </span>
                </div>
              ) : null}
              {selectedGuardian ? (
                <div className="card">
                  <strong>Linked family anchor:</strong> {selectedGuardian.name}
                  <div className="muted">{selectedGuardian.email || selectedGuardian.phone || selectedGuardian.nationalIdNumber || "No contact"}</div>
                  {selectedGuardian.nationalIdNumber ? (
                    <div className="muted">
                      Family anchor national ID: {selectedGuardian.nationalIdNumber}
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
