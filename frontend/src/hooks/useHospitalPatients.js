import { useEffect, useState, useRef } from "react";
import {
  listPatients,
  requestFamilyAnchorApprovalOtp,
  verifyFamilyAnchorApprovalOtp,
  createPatient,
  searchGuardians as searchGuardiansApi,
} from "../services/patientApi";
import { extractDocument } from "../services/aiExtractionApi";
import { parseParentIdExtraction } from "../utils/parentIdExtraction";
import { useAuth } from "../utils/auth";

const PATIENTS_QUERY_CACHE_KEY = "patients_query_cache_v1";
const PATIENTS_QUERY_CACHE_TTL_MS = 15 * 60 * 1000;

export function useHospitalPatients() {
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
  const [newGuardian, setNewGuardian] = useState({ name: "", email: "", phone: "", nationalIdNumber: "", nationalIdCountry: "KE" });
  const [parentAnchor, setParentAnchor] = useState({ nationalIdNumber: "", nationalIdCountry: "KE", displayName: "", phone: "" });
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
      const data = await listPatients({ cursorMode: true, limit: 25, q: query.trim() || undefined, cursor: nextCursor });
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
      const resolvedParentNationalIdNumber = selectedGuardian?.nationalIdNumber || newGuardian.nationalIdNumber || parentAnchor.nationalIdNumber;
      const resolvedParentNationalIdCountry = selectedGuardian?.nationalIdCountry || newGuardian.nationalIdCountry || parentAnchor.nationalIdCountry;
      const resolvedParentDisplayName = selectedGuardian?.name || newGuardian.name || parentAnchor.displayName;
      const resolvedParentPhone = selectedGuardian?.phone || newGuardian.phone || parentAnchor.phone;

      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        nationalId: form.nationalId,
        dob: form.dob,
      };

      if (needsFamilyAnchor) {
        payload.familyAnchor = {
          nationalIdNumber: resolvedParentNationalIdNumber,
          nationalIdCountry: resolvedParentNationalIdCountry,
          displayName: resolvedParentDisplayName,
          phone: resolvedParentPhone,
        };
        payload.guardianRelationship = guardianRelationship;
        payload.guardianNotes = guardianNotes;
      }

      if (selectedGuardian) payload.guardianId = selectedGuardian._id;
      if (inviteNewGuardian) payload.newGuardian = newGuardian;

      const res = await createPatient(payload);
      await fetchPatients();
      setForm({ firstName: "", lastName: "", nationalId: "", dob: "" });
      setGuardianQuery("");
      setGuardianResults([]);
      setSelectedGuardian(null);
      setGuardianRelationship("PARENT");
      setGuardianNotes("");
      setInviteNewGuardian(false);
      setFamilyAnchorEnabled(false);
      setNewGuardian({ name: "", email: "", phone: "", nationalIdNumber: "", nationalIdCountry: "KE" });
      setParentAnchor({ nationalIdNumber: "", nationalIdCountry: "KE", displayName: "", phone: "" });
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
      const data = await searchGuardiansApi(guardianQuery.trim());
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

  return {
    patients,
    nextCursor,
    hasMore,
    loadingMore,
    loading,
    query,
    setQuery,
    msg,
    familyAnchorEnabled,
    setFamilyAnchorEnabled,
    cacheReady,
    cacheBadge,
    form,
    setForm,
    guardianQuery,
    setGuardianQuery,
    guardianResults,
    guardianSearching,
    selectedGuardian,
    setSelectedGuardian,
    guardianRelationship,
    setGuardianRelationship,
    guardianNotes,
    setGuardianNotes,
    inviteNewGuardian,
    setInviteNewGuardian,
    newGuardian,
    setNewGuardian,
    parentAnchor,
    setParentAnchor,
    ocrBusy,
    ocrMsg,
    ocrPreview,
    familyApprovalBusy,
    familyApprovalMsg,
    familyApprovalOtp,
    setFamilyApprovalOtp,
    familyApprovalStatus,
    parentIdFileInputRef,
    parentIdCameraInputRef,
    isMinor,
    needsFamilyAnchor,
    fetchPatients,
    loadMore,
    create,
    applyScannedParentIdentity,
    runParentIdExtraction,
    requestFamilyOtp,
    verifyFamilyOtp,
    searchGuardians,
    resetView,
  };
}

export default useHospitalPatients;
