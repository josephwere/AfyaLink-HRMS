import { useCallback, useEffect, useMemo, useState } from "react";
import { createPharmacyReferral, listPharmacyReferrals, listRegisteredPharmacies } from "../services/pharmacyNetworkApi";

const LOCATION_KEY = "afyalink_hospital_pharmacy_location_v1";

export function useHospitalAdminPharmacyReferrals() {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(LOCATION_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const [lat, setLat] = useState(saved?.lat ?? "");
  const [lng, setLng] = useState(saved?.lng ?? "");
  const [radiusKm, setRadiusKm] = useState(saved?.radiusKm ?? 25);
  const [q, setQ] = useState("");
  const [pharmacies, setPharmacies] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    patientName: "",
    patientPhone: "",
    reason: "",
    medicationNotes: "",
    urgent: false,
  });

  const locationReady = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const selectedPharmacy = useMemo(
    () => pharmacies.find((p) => String(p._id) === String(selectedPharmacyId)) || null,
    [pharmacies, selectedPharmacyId]
  );

  const loadNearbyPharmacies = useCallback(async ({ nextQ = q, nextLat = lat, nextLng = lng, nextRadiusKm = radiusKm } = {}) => {
    if (!Number.isFinite(Number(nextLat)) || !Number.isFinite(Number(nextLng))) {
      setPharmacies([]);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const data = await listRegisteredPharmacies({ q: nextQ, lat: nextLat, lng: nextLng, radiusKm: nextRadiusKm, limit: 200 });
      const items = Array.isArray(data?.items) ? data.items : [];
      setPharmacies(items);
      if (!selectedPharmacyId && items.length) setSelectedPharmacyId(String(items[0]._id));
    } catch (err) {
      setPharmacies([]);
      setMsg(err?.message || "Failed to load nearby pharmacies");
    } finally {
      setLoading(false);
    }
  }, [lat, lng, q, radiusKm, selectedPharmacyId]);

  const loadExistingReferrals = useCallback(async () => {
    try {
      const data = await listPharmacyReferrals({ limit: 200 });
      setReferrals(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setReferrals([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng, radiusKm }));
  }, [lat, lng, radiusKm]);

  useEffect(() => {
    void loadExistingReferrals();
  }, [loadExistingReferrals]);

  useEffect(() => {
    void loadNearbyPharmacies();
  }, [loadNearbyPharmacies]);

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMsg("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setMsg("Could not read current location. Enter coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  const submitReferral = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedPharmacyId) {
      setMsg("Select a pharmacy first.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await createPharmacyReferral({
        pharmacyId: selectedPharmacyId,
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        reason: form.reason,
        medicationNotes: form.medicationNotes,
        urgent: form.urgent,
      });
      setForm({ patientName: "", patientPhone: "", reason: "", medicationNotes: "", urgent: false });
      setMsg("Referral created and shared with selected pharmacy.");
      await loadExistingReferrals();
    } catch (err) {
      setMsg(err?.message || "Failed to create referral");
    } finally {
      setSaving(false);
    }
  }, [form, loadExistingReferrals, selectedPharmacyId]);

  return {
    lat,
    setLat,
    lng,
    setLng,
    radiusKm,
    setRadiusKm,
    q,
    setQ,
    pharmacies,
    referrals,
    selectedPharmacyId,
    setSelectedPharmacyId,
    loading,
    saving,
    msg,
    setMsg,
    locating,
    form,
    setForm,
    locationReady,
    selectedPharmacy,
    loadNearbyPharmacies,
    loadExistingReferrals,
    useCurrentLocation,
    submitReferral,
  };
}

export default useHospitalAdminPharmacyReferrals;
