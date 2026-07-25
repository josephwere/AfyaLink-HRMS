import { useEffect, useMemo, useRef, useState } from "react";
import { listMarketplaceHospitals, listVerifiedHospitals } from "../services/patientApi";
import { listAppointmentsForHospital, listDoctorAvailability, listAppointmentCalls, listAppointmentSuggestions, createAppointment, createAppointmentCall } from "../services/appointmentWorkflow";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";
const PATIENT_LOCATION_KEY = "afyalink_patient_location_v1";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Nairobi";
  } catch {
    return "Africa/Nairobi";
  }
}

function getNextLocalMidnight() {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next;
}

function isSameLocalDay(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function buildBookingLockFromAppointments(appointments = []) {
  const latest = (appointments || [])
    .filter((item) => item?.createdAt && isSameLocalDay(item.createdAt) && String(item?.status || "").toLowerCase() !== "cancelled")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!latest?.createdAt) return null;
  return {
    message: "Good news! You already have an appointment booked for today.",
    nextAvailableAt: getNextLocalMidnight().toISOString(),
    lastBookedAt: latest.createdAt,
    existingAppointment: latest,
    guidance: {
      title: "You're Already Scheduled",
      message: "Good news! You already have an appointment booked for today. You can make another appointment tomorrow after midnight.",
      emergencyMessage: "If this is an emergency, please contact a healthcare provider immediately.",
    },
  };
}

function bookingLockFromError(err) {
  const code = err?.code || err?.data?.code;
  if (code !== "APPOINTMENT_DAILY_LIMIT") return null;
  const data = err?.data || {};
  return {
    message: data?.msg || err?.message || "Good news! You already have an appointment booked for today.",
    nextAvailableAt: data?.nextAvailableAt || null,
    lastBookedAt: data?.lastBookedAt || null,
    existingAppointment: data?.existingAppointment || null,
    guidance: data?.guidance || {
      title: "You're Already Scheduled",
      message: "Good news! You already have an appointment booked for today. You can make another appointment tomorrow after midnight.",
      emergencyMessage: "If this is an emergency, please contact a healthcare provider immediately.",
    },
  };
}

export function mergeAppointmentList(existingAppointments = [], nextAppointment = null) {
  if (!nextAppointment) return existingAppointments;
  const normalized = Array.isArray(existingAppointments) ? existingAppointments : [];
  const nextId = String(nextAppointment?._id || "");
  const withoutDuplicate = normalized.filter((item) => String(item?._id || "") !== nextId);
  return [nextAppointment, ...withoutDuplicate];
}

export function usePatientAppointments({ hospitalFromQuery = "", savedLocation = {} } = {}) {
  const [hospitalId, setHospitalId] = useState(() => hospitalFromQuery || localStorage.getItem(SELECTED_HOSPITAL_KEY) || "");
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [calls, setCalls] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [callMsg, setCallMsg] = useState("");
  const [bookingLock, setBookingLock] = useState(null);
  const [bookingLimitNotice, setBookingLimitNotice] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [locationMode, setLocationMode] = useState(savedLocation?.mode || "manual");
  const [lat, setLat] = useState(savedLocation?.lat ?? "");
  const [lng, setLng] = useState(savedLocation?.lng ?? "");
  const [radiusKm, setRadiusKm] = useState(savedLocation?.radiusKm ?? 15);
  const [locationLabel, setLocationLabel] = useState(savedLocation?.label || "");
  const [locating, setLocating] = useState(false);
  const autoLocationAttemptedRef = useRef(false);
  const [form, setForm] = useState({ scheduledAt: "", reason: "", doctor: "", serviceType: "General Consultation", consultationMode: "IN_PERSON" });

  const selectedHospital = useMemo(() => hospitals.find((h) => String(h._id) === String(hospitalId)) || null, [hospitals, hospitalId]);
  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => {
      const name = String(d?.name || "").toLowerCase();
      const email = String(d?.email || "").toLowerCase();
      const dept = String(d?.employment?.department || "").toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [doctors, doctorSearch]);

  const locationReady = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const bookingTimeZone = useMemo(() => getBrowserTimeZone(), []);
  const localBookingLock = useMemo(() => buildBookingLockFromAppointments(appointments), [appointments]);
  const activeBookingLock = bookingLock || localBookingLock;
  const bookingLocked = activeBookingLock?.nextAvailableAt && Date.now() < new Date(activeBookingLock.nextAvailableAt).getTime();

  const loadHospitals = async () => {
    try {
      const options = { limit: 200 };
      if (hospitalQuery.trim()) options.q = hospitalQuery.trim();
      if (locationReady) {
        options.lat = lat;
        options.lng = lng;
        options.radiusKm = radiusKm;
      }

      let rows = [];
      try {
        const data = await listMarketplaceHospitals(options);
        rows = Array.isArray(data?.items) ? data.items : [];
      } catch {
        rows = [];
      }

      if (!rows.length) {
        try {
          const fallbackData = await listVerifiedHospitals({ limit: 200 });
          rows = Array.isArray(fallbackData?.items) ? fallbackData.items : [];
        } catch {
          rows = [];
        }
      }

      setHospitals(rows);
      if (!hospitalId && rows.length) {
        const id = String(rows[0]._id);
        setHospitalId(id);
        localStorage.setItem(SELECTED_HOSPITAL_KEY, id);
      }
    } catch {
      setHospitals([]);
    }
  };

  const loadAppointments = async () => {
    if (!hospitalId) { setAppointments([]); return; }
    setLoading(true);
    setMsg("");
    try {
      const data = await listAppointmentsForHospital(hospitalId, { limit: 50 });
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setAppointments(rows);
      setBookingLock(null);
    } catch (e) {
      setAppointments([]);
      setMsg(e?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    if (!hospitalId) { setDoctors([]); return; }
    try {
      const data = await listDoctorAvailability(hospitalId);
      setDoctors(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setDoctors([]);
    }
  };

  const loadCalls = async () => {
    if (!hospitalId) { setCalls([]); return; }
    try {
      const data = await listAppointmentCalls(hospitalId);
      setCalls(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setCalls([]);
    }
  };

  const loadSuggestions = async () => {
    if (!hospitalId || !form.serviceType) { setSuggestions([]); return; }
    try {
      const data = await listAppointmentSuggestions({ hospitalId, serviceType: form.serviceType, consultationMode: form.consultationMode, preferredDate: form.scheduledAt, limit: 4 });
      setSuggestions(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => { void loadHospitals(); }, [lat, lng, radiusKm, locationReady, hospitalQuery]);
  useEffect(() => { if (!hospitalId) return; localStorage.setItem(SELECTED_HOSPITAL_KEY, hospitalId); setDoctorSearch(""); void loadDoctors(); void loadAppointments(); void loadCalls(); }, [hospitalId]);
  useEffect(() => { if (!hospitalId) return undefined; const timer = setInterval(() => { void loadAppointments(); void loadCalls(); }, 15000); return () => clearInterval(timer); }, [hospitalId]);
  useEffect(() => { if (!hospitalId) return; void loadSuggestions(); }, [hospitalId, form.serviceType, form.consultationMode, form.scheduledAt]);
  useEffect(() => { if (!form.doctor) return; if (!doctors.some((d) => String(d._id) === String(form.doctor))) setForm((p) => ({ ...p, doctor: "" })); }, [doctors, form.doctor]);
  useEffect(() => { localStorage.setItem(PATIENT_LOCATION_KEY, JSON.stringify({ mode: locationMode, lat, lng, radiusKm, label: locationLabel })); }, [locationMode, lat, lng, radiusKm, locationLabel]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setMsg("Geolocation is not available in this browser."); return; }
    setLocating(true); setMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocationMode("gps");
        setLocationLabel("Current location");
        setLocating(false);
      },
      () => {
        setMsg("Could not read your current location. You can still search by town, county, or a landmark.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation || lat || lng || locating || autoLocationAttemptedRef.current) return;
    autoLocationAttemptedRef.current = true;
    useCurrentLocation();
  }, [lat, lng, locating]);

  const showDailyLimitNotice = (lock) => { if (!lock) return; setBookingLimitNotice(lock); setMsg(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (!hospitalId || !form.scheduledAt) { setMsg("Select hospital and date/time"); return; }
    if (bookingLocked) { showDailyLimitNotice(activeBookingLock); return; }
    setSaving(true); setMsg("");
    try {
      const appointment = await createAppointment({ hospitalId, scheduledAt: form.scheduledAt, reason: form.reason || undefined, serviceType: form.serviceType, consultationMode: form.consultationMode, doctor: form.doctor || undefined, timeZone: bookingTimeZone });
      setBookingSuccess({ appointment, scheduledAt: appointment?.scheduledAt || form.scheduledAt, serviceType: appointment?.serviceType || form.serviceType, consultationMode: appointment?.consultationMode || form.consultationMode, hospitalName: selectedHospital?.name || "Selected hospital" });
      setAppointments((prev) => mergeAppointmentList(prev, appointment));
      window.dispatchEvent(new CustomEvent("afyalink:notification-local", { detail: { title: "Appointment confirmed", body: `${appointment?.serviceType || form.serviceType || "General Consultation"} has been booked.`, category: "CLINICAL", meta: { appointmentId: appointment?._id, path: "/patient/appointments" } } }));
      setForm({ scheduledAt: "", reason: "", doctor: "", serviceType: "General Consultation", consultationMode: "IN_PERSON" });
      setMsg("Appointment request submitted.");
      await loadAppointments();
    } catch (e2) {
      const lock = bookingLockFromError(e2);
      if (lock) { setBookingLock(lock); showDailyLimitNotice(lock); } else { setMsg(e2?.message || "Failed to create appointment"); }
    } finally { setSaving(false); }
  };

  const bookSuggestedSlot = async (suggestion) => {
    const slotDate = suggestion?.appointmentTime ? new Date(suggestion.appointmentTime) : null;
    if (!hospitalId || !slotDate || Number.isNaN(slotDate.getTime())) { setMsg("Suggested slot is not ready."); return; }
    if (bookingLocked) { showDailyLimitNotice(activeBookingLock); return; }
    setSaving(true); setMsg("");
    try {
      const appointment = await createAppointment({ hospitalId, doctor: suggestion.doctorId, scheduledAt: slotDate.toISOString(), serviceType: form.serviceType, consultationMode: form.consultationMode, reason: form.reason || undefined, timeZone: bookingTimeZone });
      setBookingSuccess({ appointment, scheduledAt: appointment?.scheduledAt || slotDate.toISOString(), serviceType: appointment?.serviceType || form.serviceType, consultationMode: appointment?.consultationMode || form.consultationMode, hospitalName: selectedHospital?.name || "Selected hospital", doctorName: suggestion?.doctorName || "" });
      setAppointments((prev) => mergeAppointmentList(prev, appointment));
      window.dispatchEvent(new CustomEvent("afyalink:notification-local", { detail: { title: "Appointment confirmed", body: `${appointment?.serviceType || form.serviceType || "General Consultation"} has been booked.`, category: "CLINICAL", meta: { appointmentId: appointment?._id, path: "/patient/appointments" } } }));
      setMsg("Suggested slot booked.");
      await loadAppointments();
    } catch (err) { const lock = bookingLockFromError(err); if (lock) { setBookingLock(lock); showDailyLimitNotice(lock); } else { setMsg(err?.message || "Failed to book suggested slot"); } } finally { setSaving(false); }
  };

  const startConsultation = async (appointmentId, callType) => {
    setCallMsg("");
    try {
      await createAppointmentCall({ hospitalId, appointmentId, callType });
      window.dispatchEvent(new CustomEvent("afyalink:calls-refresh"));
      setCallMsg(`${callType === "VIDEO" ? "Video" : "Voice"} consultation request sent. We will notify you when the doctor accepts.`);
      await loadCalls();
    } catch (err) { setCallMsg(err?.message || "Could not start consultation request"); }
  };

  return { hospitalId, setHospitalId, hospitals, setHospitals, doctors, setDoctors, appointments, setAppointments, calls, setCalls, suggestions, setSuggestions, loading, saving, msg, setMsg, callMsg, setCallMsg, bookingLock, setBookingLock, bookingLimitNotice, setBookingLimitNotice, bookingSuccess, setBookingSuccess, doctorSearch, setDoctorSearch, hospitalQuery, setHospitalQuery, locationMode, setLocationMode, lat, setLat, lng, setLng, radiusKm, setRadiusKm, locationLabel, setLocationLabel, locating, setLocating, form, setForm, selectedHospital, filteredDoctors, locationReady, bookingTimeZone, activeBookingLock, bookingLocked, useCurrentLocation, submit, bookSuggestedSlot, startConsultation, loadAppointments, loadHospitals, loadDoctors, loadCalls, loadSuggestions };
}

export default usePatientAppointments;
