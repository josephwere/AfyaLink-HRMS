import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useUserContext } from "../../contexts/UserContextContext";
import { usePatientLanguage } from "../../utils/patientLanguage.jsx";
import usePatientAppointments from "../../hooks/usePatientAppointments";
import { filterDoctorsForDiscovery, getDoctorRecommendation } from "./doctorDiscoveryUtils";
import { buildJourneySteps } from "./patientJourneyUtils";
import { getAppointmentFlowStage, getVisibleHospitals } from "./appointmentLayoutUtils";
import { getAppointmentExperienceAccessMessage, getPatientAppointmentFeatureFlagState, isPatientExperienceMode } from "./appointmentFeatureFlags";
import { getPersonalizedGreeting } from "./patientGreetingUtils";
import { shouldShowMapSelectionCard } from "./mapSelectionUtils";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";
const PATIENT_LOCATION_KEY = "afyalink_patient_location_v1";
const PATIENT_DISCOVERY_COMPLETE_KEY = "afyalink_patient_discovery_complete_v1";
const PATIENT_PANEL_COLLAPSE_KEY = "afyalink_patient_map_panel_collapsed_v1";
const PATIENT_CONTEXT_STORAGE_KEY = "afyalink_patient_experience_mode";
const CALL_HISTORY_DAYS = 30;

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Nairobi";
  } catch {
    return "Africa/Nairobi";
  }
}

function formatDateTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function resolveDoctorName(appointment) {
  if (!appointment?.doctor) return "Hospital will assign one";
  if (typeof appointment.doctor === "object") return appointment.doctor.name || "Assigned doctor";
  return appointment.doctor;
}

function getCallTime(call) {
  return new Date(call?.endedAt || call?.updatedAt || call?.createdAt || Date.now());
}

function isRecentHistoryCall(call) {
  const status = String(call?.status || "").toUpperCase();
  if (!["ENDED", "TERMINATED"].includes(status)) return false;
  const time = getCallTime(call).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= CALL_HISTORY_DAYS * 24 * 60 * 60 * 1000;
}

function getHistoryDayLabel(call) {
  const time = getCallTime(call);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (time.toDateString() === today.toDateString()) return "Today";
  if (time.toDateString() === yesterday.toDateString()) return "Yesterday";
  return time.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function getDoctorAvailability(doctor) {
  const rawStatus = String(doctor?.doctorStatus || doctor?.status || "").toUpperCase();
  if (rawStatus.includes("CONSULT") || rawStatus.includes("BUSY")) {
    return { label: "Busy In Consultation", tone: "warning" };
  }
  if (doctor?.availableToday && doctor?.consultationAvailable !== false && rawStatus !== "OFFLINE") {
    return { label: "Available Now", tone: "connected" };
  }
  return { label: "Offline", tone: "muted" };
}

function getHospitalRecommendation(hospital, index = 0) {
  const distanceKm = Number(hospital?.distanceKm);
  const distanceScore = Number.isFinite(distanceKm) ? Math.max(0, 100 - Math.min(distanceKm * 6, 70)) : 73;
  const verifiedBoost = hospital?.verification?.badgeLabel || hospital?.isVerified ? 6 : 0;
  const ratingBoost = hospital?.rating ? 2 : 0;
  const score = Math.max(82, Math.min(99, Math.round(distanceScore + verifiedBoost + ratingBoost + (index % 2 === 0 ? 3 : 1))));
  const reasons = [];
  if (Number.isFinite(distanceKm) && distanceKm <= 5) reasons.push("Closest specialist");
  if (hospital?.verification?.badgeLabel || hospital?.isVerified) reasons.push("Verified provider");
  if (hospital?.address) reasons.push("Live availability");
  if (index % 2 === 0) reasons.push("Video consult ready");
  if (!reasons.length) reasons.push("Recommended today");
  return { score, reasons: reasons.slice(0, 4) };
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
  if (code !== "APPOINTMENT_DAILY_LIMIT") {
    return null;
  }
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

function formatSlotLabel(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MyAppointments() {
  const { t } = usePatientLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isWorkMode, isMyHealthMode, setMode, canUseMyHealthContext } = useUserContext();
  const [searchParams] = useSearchParams();
  const hospitalFromQuery = searchParams.get("hospitalId") || "";
  const [patientExperienceMode, setPatientExperienceMode] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(PATIENT_CONTEXT_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const savedLocation = (() => {
    try {
      return JSON.parse(localStorage.getItem(PATIENT_LOCATION_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const {
    hospitalId,
    setHospitalId,
    hospitals,
    doctors,
    appointments,
    calls,
    suggestions,
    loading,
    saving,
    msg,
    setMsg,
    callMsg,
    setCallMsg,
    bookingLock,
    setBookingLock,
    bookingLimitNotice,
    setBookingLimitNotice,
    bookingSuccess,
    setBookingSuccess,
    doctorSearch,
    setDoctorSearch,
    hospitalQuery,
    setHospitalQuery,
    locationMode,
    setLocationMode,
    lat,
    setLat,
    lng,
    setLng,
    radiusKm,
    setRadiusKm,
    locationLabel,
    setLocationLabel,
    locating,
    setLocating,
    form,
    setForm,
    selectedHospital,
    filteredDoctors,
    locationReady,
    bookingTimeZone,
    activeBookingLock,
    bookingLocked,
    useCurrentLocation,
    submit,
    bookSuggestedSlot,
    startConsultation,
  } = usePatientAppointments({ hospitalFromQuery, savedLocation });

  const resolvedMode = useMemo(() => {
    if (!canUseMyHealthContext) return false;
    if (isMyHealthMode) return true;
    if (isWorkMode) return false;
    const explicitMode = searchParams.get("mode") || patientExperienceMode || "";
    return isPatientExperienceMode(user, explicitMode);
  }, [canUseMyHealthContext, isMyHealthMode, isWorkMode, patientExperienceMode, searchParams, user]);

  const accessMessage = useMemo(() => getAppointmentExperienceAccessMessage(user), [user]);

  const persistPatientExperienceMode = (mode) => {
    setPatientExperienceMode(mode);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PATIENT_CONTEXT_STORAGE_KEY, mode);
      } catch {
        // Ignore storage failures.
      }
    }
  };

  const switchToMyHealth = () => {
    persistPatientExperienceMode("patient");
    setMode("MY_HEALTH");
    navigate("/app/portal/appointments/index?mode=patient", { replace: true });
  };

  const [discoveryStepIndex, setDiscoveryStepIndex] = useState(0);
  const [discoveryComplete, setDiscoveryComplete] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PATIENT_DISCOVERY_COMPLETE_KEY) === "true";
  });
  const [showAllHospitalsDrawer, setShowAllHospitalsDrawer] = useState(false);
  const [hospitalSortMode, setHospitalSortMode] = useState("recommended");
  const [mapZoom, setMapZoom] = useState(2);
  const [showNearbyHospitalsList, setShowNearbyHospitalsList] = useState(false);
  const [selectedMapHospitalId, setSelectedMapHospitalId] = useState(hospitalId || "");
  const [hoveredHospitalId, setHoveredHospitalId] = useState("");
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PATIENT_PANEL_COLLAPSE_KEY) === "true";
  });
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isHospitalInfoTransitioning, setIsHospitalInfoTransitioning] = useState(false);
  const [isMapDetailExpanded, setIsMapDetailExpanded] = useState(false);
  const [routeSummary, setRouteSummary] = useState(null);
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const [mapLoadError, setMapLoadError] = useState("");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [doctorFilters, setDoctorFilters] = useState({ specialty: "", language: "", gender: "", availability: "", consultationMode: "", insurance: "" });
  const mapShellRef = useRef(null);
  const mapContainerRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkersRef = useRef([]);
  const googleDirectionsRendererRef = useRef(null);
  const markerBounceTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const panelResizeTimerRef = useRef(null);
  const mapPanTimerRef = useRef(null);
  const mapsApiKey = useMemo(() => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || "", []);
  const [journeyState, setJourneyState] = useState({ bookingSuccess: Boolean(bookingSuccess), bookingConfirmed: Boolean(bookingSuccess), doctorAssigned: Boolean(bookingSuccess?.appointment?.doctor), appointmentBooked: Boolean(bookingSuccess) });
  const featureFlags = useMemo(() => getPatientAppointmentFeatureFlagState(), []);
  const {
    discovery: discoveryEnabled,
    map: mapEnabled,
    hospitalDrawer: hospitalDrawerEnabled,
    doctorMarketplace: doctorMarketplaceEnabled,
    aiRecommendations: aiRecommendationsEnabled,
  } = featureFlags;
  const journeySteps = useMemo(() => buildJourneySteps(journeyState), [journeyState]);

  useEffect(() => {
    if (discoveryComplete) {
      setDiscoveryStepIndex(4);
      return;
    }

    const stepSequence = [0, 1, 2, 3, 4];
    const timers = stepSequence.map((index) => setTimeout(() => setDiscoveryStepIndex(index), index * 900));
    const finishTimer = setTimeout(() => {
      setDiscoveryComplete(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PATIENT_DISCOVERY_COMPLETE_KEY, "true");
      }
    }, stepSequence.length * 900 + 250);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [discoveryComplete]);

  useEffect(() => {
    setJourneyState((prev) => ({
      ...prev,
      bookingSuccess: Boolean(bookingSuccess),
      bookingConfirmed: Boolean(bookingSuccess),
      appointmentBooked: Boolean(bookingSuccess),
      doctorAssigned: Boolean(bookingSuccess?.appointment?.doctor || prev.doctorAssigned),
      hasDoctor: Boolean(bookingSuccess?.appointment?.doctor || prev.hasDoctor),
    }));
  }, [bookingSuccess]);

  const displayHospitals = useMemo(() => getVisibleHospitals(hospitals, false, 3), [hospitals]);
  const showMapSelectionCard = useMemo(() => shouldShowMapSelectionCard(selectedMapHospitalId, hospitalId), [selectedMapHospitalId, hospitalId]);
  const filteredDoctorsForDiscovery = useMemo(() => filterDoctorsForDiscovery(doctors, doctorFilters), [doctors, doctorFilters]);
  const selectedHospitalId = String(hospitalId || "");
  const flowStage = useMemo(() => getAppointmentFlowStage({
    selectedHospital: Boolean(selectedHospital),
    selectedDoctor: Boolean(form.doctor),
    appointmentReady: Boolean(form.scheduledAt),
    bookingSuccess: Boolean(bookingSuccess),
  }), [selectedHospital, form.doctor, form.scheduledAt, bookingSuccess]);
  const sortedHospitals = useMemo(() => {
    const rows = [...hospitals];
    if (hospitalSortMode === "rating") {
      rows.sort((a, b) => Number(b?.rating || 0) - Number(a?.rating || 0));
    } else if (hospitalSortMode === "distance") {
      rows.sort((a, b) => (Number(a?.distanceKm || 999) - Number(b?.distanceKm || 999)) || (String(a?.name || "").localeCompare(String(b?.name || ""))));
    }
    return rows;
  }, [hospitals, hospitalSortMode]);
  const directionsHref = useMemo(() => {
    if (!selectedHospital) return null;
    const query = [selectedHospital?.name, selectedHospital?.address].filter(Boolean).join(" ");
    if (!query) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }, [selectedHospital]);
  const handleSelectHospital = useCallback((nextId) => {
    const id = String(nextId || "");
    if (!id) return;
    const nextHospital = hospitals.find((hospital) => String(hospital._id) === id);
    setHospitalId(id);
    setSelectedMapHospitalId(id);
    setIsPanelCollapsed(false);
    setIsMobileSheetOpen(true);
    setIsMapDetailExpanded(false);
    setIsHospitalInfoTransitioning(true);
    clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => setIsHospitalInfoTransitioning(false), 220);
    if (googleMapRef.current && window.google?.maps && nextHospital) {
      const latValue = Number(nextHospital?.location?.lat ?? nextHospital?.lat ?? nextHospital?.coordinates?.lat);
      const lngValue = Number(nextHospital?.location?.lng ?? nextHospital?.lng ?? nextHospital?.coordinates?.lng);
      if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
        const position = new window.google.maps.LatLng(latValue, lngValue);
        const map = googleMapRef.current;
        const bounds = map.getBounds?.();
        const isVisible = bounds && bounds.contains(position);
        if (!isVisible) {
          if (mapPanTimerRef.current) {
            window.clearTimeout(mapPanTimerRef.current);
          }
          mapPanTimerRef.current = window.setTimeout(() => {
            map.panTo(position);
            if (!prefersReducedMotion) {
              map.panBy(0, -110);
            }
          }, 50);
        } else if (!prefersReducedMotion) {
          map.panBy(0, -110);
        }
        // Preserve zoom unless the selection requires a new level of detail.
        if (map.getZoom() < 13) {
          map.setZoom(13);
        }
      }
    }
  }, [hospitals, setHospitalId, prefersReducedMotion]);

  const pulseSelectedMarker = useCallback((id) => {
    if (!window.google?.maps || !googleMarkersRef.current.length) return;
    const googleMaps = window.google.maps;
    const marker = googleMarkersRef.current.find((markerItem) => String(markerItem.hospitalId) === String(id));
    if (!marker) return;
    marker.setAnimation(googleMaps.Animation.BOUNCE);
    if (markerBounceTimerRef.current) {
      window.clearTimeout(markerBounceTimerRef.current);
    }
    markerBounceTimerRef.current = window.setTimeout(() => marker.setAnimation(null), 650);
  }, []);

  const mapHospital = useMemo(() => {
    if (!selectedMapHospitalId) return selectedHospital;
    return hospitals.find((hospital) => String(hospital._id) === String(selectedMapHospitalId)) || selectedHospital;
  }, [hospitals, selectedMapHospitalId, selectedHospital]);
  const toggleFullscreen = useCallback(() => {
    if (!mapShellRef.current) return;
    const doc = document;
    if (!isMapFullscreen) {
      if (mapShellRef.current.requestFullscreen) {
        mapShellRef.current.requestFullscreen();
      } else if (mapShellRef.current.webkitRequestFullscreen) {
        mapShellRef.current.webkitRequestFullscreen();
      } else if (mapShellRef.current.msRequestFullscreen) {
        mapShellRef.current.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  }, [isMapFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document;
      setIsMapFullscreen(
        doc.fullscreenElement === mapShellRef.current ||
        doc.webkitFullscreenElement === mapShellRef.current ||
        doc.msFullscreenElement === mapShellRef.current
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleViewRoute = useCallback(() => {
    setIsMapDetailExpanded(true);
    if (!googleMapRef.current || !window.google?.maps || !mapHospital) return;
    const latValue = Number(mapHospital?.location?.lat ?? mapHospital?.lat ?? mapHospital?.coordinates?.lat);
    const lngValue = Number(mapHospital?.location?.lng ?? mapHospital?.lng ?? mapHospital?.coordinates?.lng);
    if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) return;
    const position = new window.google.maps.LatLng(latValue, lngValue);
    googleMapRef.current.panTo(position);
    googleMapRef.current.panBy(0, -110);
    googleMapRef.current.setZoom(13);
  }, [mapHospital]);
  const mapHospitalDistance = useMemo(() => {
    if (!mapHospital) return null;
    const distance = Number(mapHospital.distanceKm);
    return Number.isFinite(distance) ? `${distance.toFixed(1)} km away` : "Nearby";
  }, [mapHospital]);
  const mapEmbedQuery = useMemo(() => {
    const queryParts = [];
    if (mapHospital?.name) queryParts.push(mapHospital.name);
    if (mapHospital?.address) queryParts.push(mapHospital.address);
    if (locationLabel) queryParts.push(locationLabel);
    if (!queryParts.length) queryParts.push("Nairobi Hospital");
    return queryParts.join(" ");
  }, [mapHospital, locationLabel]);

  useEffect(() => {
    if (hospitalId) {
      setSelectedMapHospitalId(String(hospitalId));
      setIsMapDetailExpanded(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    return () => {
      if (markerBounceTimerRef.current) {
        window.clearTimeout(markerBounceTimerRef.current);
      }
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (mapPanTimerRef.current) {
        window.clearTimeout(mapPanTimerRef.current);
      }
      if (panelResizeTimerRef.current) {
        window.clearTimeout(panelResizeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_PANEL_COLLAPSE_KEY, isPanelCollapsed ? "true" : "false");
    if (googleMapRef.current && window.google?.maps) {
      if (panelResizeTimerRef.current) {
        window.clearTimeout(panelResizeTimerRef.current);
      }
      panelResizeTimerRef.current = window.setTimeout(() => {
        window.google.maps.event.trigger(googleMapRef.current, "resize");
      }, 280);
    }
    return () => {
      if (panelResizeTimerRef.current) {
        window.clearTimeout(panelResizeTimerRef.current);
      }
    };
  }, [isPanelCollapsed]);

  useEffect(() => {
    if (!mapsApiKey) {
      setMapLoadError("Add VITE_GOOGLE_MAPS_API_KEY to enable the live discovery map.");
      return;
    }
    if (!mapContainerRef.current) return;

    const initializeMap = () => {
      if (!window.google?.maps) return;
      if (!googleMapRef.current) {
        const initialCenter = locationReady && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
          ? { lat: Number(lat), lng: Number(lng) }
          : { lat: -1.286389, lng: 36.817223 };
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: "greedy",
        });
        googleMapRef.current = map;
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#2563eb",
            strokeWeight: 4,
            strokeOpacity: 0.9,
          },
        });
        directionsRenderer.setMap(map);
        googleDirectionsRendererRef.current = directionsRenderer;
      }

      const map = googleMapRef.current;
      const googleMaps = window.google.maps;
      const markers = googleMarkersRef.current;
      markers.forEach((marker) => marker.setMap(null));
      googleMarkersRef.current = [];

      const hospitalCoordinates = hospitals.filter((hospital) => {
        const latValue = Number(hospital?.location?.lat ?? hospital?.lat ?? hospital?.coordinates?.lat);
        const lngValue = Number(hospital?.location?.lng ?? hospital?.lng ?? hospital?.coordinates?.lng);
        return Number.isFinite(latValue) && Number.isFinite(lngValue);
      });

      const bounds = new googleMaps.LatLngBounds();
      if (locationReady && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        const userPosition = new googleMaps.LatLng(Number(lat), Number(lng));
        bounds.extend(userPosition);
        map.setCenter(userPosition);
      }

      hospitalCoordinates.forEach((hospital) => {
        const latValue = Number(hospital?.location?.lat ?? hospital?.lat ?? hospital?.coordinates?.lat);
        const lngValue = Number(hospital?.location?.lng ?? hospital?.lng ?? hospital?.coordinates?.lng);
        const position = new googleMaps.LatLng(latValue, lngValue);
        bounds.extend(position);
        const isSelected = String(hospital._id) === String(selectedMapHospitalId || hospitalId || "");
        const isHovered = String(hospital._id) === String(hoveredHospitalId || "");
        const marker = new googleMaps.Marker({
          position,
          map,
          title: hospital.name,
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            scale: isSelected ? 12 : isHovered ? 10 : 8,
            fillColor: isSelected ? "#0f766e" : isHovered ? "#1d4ed8" : "#2563eb",
            fillOpacity: 0.95,
            strokeColor: "#ffffff",
            strokeWeight: isSelected ? 3 : 2,
          },
          animation: isSelected ? googleMaps.Animation.BOUNCE : googleMaps.Animation.DROP,
        });
        marker.addListener("click", () => {
          handleSelectHospital(hospital._id);
          if (markerBounceTimerRef.current) {
            window.clearTimeout(markerBounceTimerRef.current);
          }
          marker.setAnimation(googleMaps.Animation.BOUNCE);
          markerBounceTimerRef.current = window.setTimeout(() => marker.setAnimation(null), 650);
        });
        marker.addListener("mouseover", () => setHoveredHospitalId(String(hospital._id)));
        marker.addListener("mouseout", () => setHoveredHospitalId((current) => (current === String(hospital._id) ? "" : current)));
        marker.hospitalId = String(hospital._id);
        googleMarkersRef.current.push(marker);
      });

      if (locationReady && hospitalCoordinates.length) {
        map.fitBounds(bounds, 60);
      } else if (locationReady) {
        map.setZoom(13);
      }

      const selectedHospitalCoords = mapHospital ? {
        lat: Number(mapHospital?.location?.lat ?? mapHospital?.lat ?? mapHospital?.coordinates?.lat),
        lng: Number(mapHospital?.location?.lng ?? mapHospital?.lng ?? mapHospital?.coordinates?.lng),
      } : null;
      const hasRouteableCoords = locationReady && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && selectedHospitalCoords && Number.isFinite(selectedHospitalCoords.lat) && Number.isFinite(selectedHospitalCoords.lng);
      if (hasRouteableCoords && googleDirectionsRendererRef.current) {
        const directionsService = new googleMaps.DirectionsService();
        directionsService.route({
          origin: { lat: Number(lat), lng: Number(lng) },
          destination: { lat: selectedHospitalCoords.lat, lng: selectedHospitalCoords.lng },
          travelMode: googleMaps.TravelMode.DRIVING,
        }, (result, status) => {
          if (status === googleMaps.DirectionsStatus.OK && result?.routes?.[0]) {
            googleDirectionsRendererRef.current.setDirections(result);
            const leg = result.routes[0].legs[0];
            setRouteSummary({
              distance: leg?.distance?.text || null,
              duration: leg?.duration?.text || null,
            });
          } else {
            googleDirectionsRendererRef.current.setDirections(null);
            setRouteSummary(null);
          }
        });
      } else {
        googleDirectionsRendererRef.current?.setDirections(null);
        setRouteSummary(null);
      }
    };

    if (window.google?.maps) {
      initializeMap();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    const onLoad = () => initializeMap();
    if (existingScript) {
      existingScript.addEventListener("load", onLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = onLoad;
    script.onerror = () => setMapLoadError("Unable to load the Google Maps script.");
    document.head.appendChild(script);
  }, [mapsApiKey, hospitals, lat, lng, locationReady, hospitalId, selectedMapHospitalId, mapHospital, handleSelectHospital]);

  useEffect(() => {
    if (!window.google?.maps || !googleMarkersRef.current.length) return;
    const googleMaps = window.google.maps;
    googleMarkersRef.current.forEach((marker) => {
      const isSelected = String(marker.hospitalId) === String(selectedMapHospitalId || hospitalId || "");
      const isHovered = String(marker.hospitalId) === String(hoveredHospitalId || "");
      marker.setIcon({
        path: googleMaps.SymbolPath.CIRCLE,
        scale: isSelected ? 12 : isHovered ? 10 : 8,
        fillColor: isSelected ? "#0f766e" : isHovered ? "#1d4ed8" : "#2563eb",
        fillOpacity: 0.95,
        strokeColor: "#ffffff",
        strokeWeight: isSelected ? 3 : 2,
      });
    });
  }, [hoveredHospitalId, selectedMapHospitalId, hospitalId]);

  const suggestedSlotsBySection = useMemo(() => {
    const sections = { Morning: [], Afternoon: [], Evening: [] };
    suggestions.forEach((item) => {
      const slot = item?.appointmentTime ? new Date(item.appointmentTime) : null;
      const hour = slot && !Number.isNaN(slot.getTime()) ? slot.getHours() : null;
      if (hour === null) {
        sections.Evening.push(item);
      } else if (hour < 12) {
        sections.Morning.push(item);
      } else if (hour < 17) {
        sections.Afternoon.push(item);
      } else {
        sections.Evening.push(item);
      }
    });
    return sections;
  }, [suggestions]);

  const consultationHistory = useMemo(
    () => calls.filter(isRecentHistoryCall).sort((a, b) => getCallTime(b) - getCallTime(a)).slice(0, 8),
    [calls]
  );

  const showDailyLimitNotice = (lock) => {
    if (!lock) return;
    setBookingLimitNotice(lock);
    setMsg("");
  };

  const openAiAssistant = (prompt) => {
    if (!aiRecommendationsEnabled) return;
    window.dispatchEvent(
      new CustomEvent("afyalink:ai-open", {
        detail: {
          prompt,
          source: "patient-appointments",
        },
      })
    );
  };


  if (!resolvedMode) {
    return (
      <div className="dashboard">
        <div className="card premium-card" style={{ maxWidth: 760, margin: "24px auto" }}>
          <div className="appointment-success-kicker">My Health</div>
          <h2>{accessMessage?.title || "Book Personal Appointment"}</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {accessMessage?.body || "You are currently using AfyaLink in Work Mode. Appointments for treatment are booked in your personal health profile."}
          </p>
          <div className="appointment-success-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn-primary" onClick={switchToMyHealth}>
              {accessMessage?.actionLabel || "Switch to My Health"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Return to work
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel patient-hero-card">
        <div className="patient-hero-copy">
          <div className="appointment-success-kicker"> Healthcare Appointment discovery</div>
          <h2>{getPersonalizedGreeting(user, new Date())}</h2>
          <p className="muted">Find the best healthcare near you and move from discovery to booking in a guided experience.</p>
          <div className="patient-flow-progress">
            <div className="appointment-success-kicker">Journey progress · stage {flowStage} / 4</div>
            <div className="patient-flow-step-row">
              {[
                { label: "Discover", hint: "Location" },
                { label: "Hospital", hint: "Selection" },
                { label: "Doctor", hint: "Match" },
                { label: "Booking", hint: "Confirm" },
              ].map((item, index) => (
                <div key={item.label} className={`patient-flow-step ${flowStage >= index + 1 ? "active" : ""}`}>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="patient-hero-meta">
          <div className="patient-hero-pill">📍 {locationLabel || "Nairobi CBD"}</div>
          <div className="patient-hero-pill">✓ GPS Connected</div>
          <div className="patient-hero-pill">{hospitals.length} hospitals nearby</div>
          <button type="button" className="btn-secondary" onClick={useCurrentLocation} disabled={locating}>Refresh Location</button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}
      {callMsg && <div className="card">{callMsg}</div>}
      {bookingLimitNotice && (
        <div className="appointment-success-backdrop" role="dialog" aria-modal="true" aria-live="polite">
          <div className="appointment-success-modal">
            <button
              type="button"
              className="appointment-success-close"
              onClick={() => setBookingLimitNotice(null)}
              aria-label="Close booking limit message"
            >
              ×
            </button>
            <div className="appointment-success-icon appointment-limit-icon" aria-hidden="true">★</div>
            <div className="appointment-success-kicker">Daily booking limit</div>
            <h2>{bookingLimitNotice.guidance?.title || "You're Already Scheduled"}</h2>
            <p>
              {bookingLimitNotice.guidance?.message ||
                "Good news! You already have an appointment booked for today. You can make another appointment tomorrow after midnight."}
            </p>
            <div className="appointment-success-summary">
              <strong>Your Appointment</strong>
              <dl>
                <dt>Date & time</dt>
                <dd>{formatDateTime(bookingLimitNotice.existingAppointment?.scheduledAt)}</dd>
                <dt>Doctor</dt>
                <dd>{resolveDoctorName(bookingLimitNotice.existingAppointment)}</dd>
                <dt>Status</dt>
                <dd>{bookingLimitNotice.existingAppointment?.status || "Confirmed"}</dd>
                <dt>Service</dt>
                <dd>{bookingLimitNotice.existingAppointment?.serviceType || "General Consultation"}</dd>
                <dt>Next booking</dt>
                <dd>{formatDateTime(bookingLimitNotice.nextAvailableAt)}</dd>
              </dl>
            </div>
            <div className="success-guide-panel">
              <strong>Need assistance before then?</strong>
              <ul>
                <li>Chat with the AI Health Assistant while you wait.</li>
                <li>Connect with an online doctor if your appointment has a clinician assigned.</li>
                <li>Review your upcoming appointment details any time.</li>
              </ul>
            </div>
            <p className="muted">
              {bookingLimitNotice.guidance?.emergencyMessage ||
                "If this is an emergency, please contact a healthcare provider immediately."}
            </p>
            <div className="appointment-success-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!aiRecommendationsEnabled}
                onClick={() => {
                  setBookingLimitNotice(null);
                  openAiAssistant("I already have an appointment today. Help me prepare questions, symptoms, and next steps while I wait.");
                }}
              >
                {aiRecommendationsEnabled ? "AI Assistant" : "AI Assistant Disabled"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!bookingLimitNotice.existingAppointment?._id || !bookingLimitNotice.existingAppointment?.doctor}
                onClick={async () => {
                  const appointmentId = bookingLimitNotice.existingAppointment?._id;
                  setBookingLimitNotice(null);
                  if (appointmentId) await startConsultation(appointmentId, "VOICE");
                }}
              >
                Online Doctor
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setBookingLimitNotice(null);
                  document.getElementById("patient-appointments-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                My Appointment
              </button>
            </div>
          </div>
        </div>
      )}
      {bookingSuccess && (
        <div className="appointment-success-backdrop" role="dialog" aria-modal="true" aria-live="polite">
          <div className="appointment-success-modal">
            <button
              type="button"
              className="appointment-success-close"
              onClick={() => setBookingSuccess(null)}
              aria-label="Close appointment success message"
            >
              ×
            </button>
            <div className="appointment-success-icon" aria-hidden="true">✓</div>
            <div className="appointment-success-kicker">Premium confirmation</div>
            <h2>Appointment Ready for Your Care Journey</h2>
            <p>Your appointment is confirmed and the next steps are now visible in one place. Use the actions below to prepare, join, or share the booking reference.</p>
            <div className="appointment-success-summary">
              <dl>
                <dt>Date & time</dt>
                <dd>{formatDateTime(bookingSuccess.scheduledAt)}</dd>
                <dt>Hospital</dt>
                <dd>{bookingSuccess.hospitalName}</dd>
                <dt>Service</dt>
                <dd>{bookingSuccess.serviceType || "General Consultation"}</dd>
                <dt>Mode</dt>
                <dd>{String(bookingSuccess.consultationMode || "IN_PERSON").replace(/_/g, " ")}</dd>
                <dt>Doctor</dt>
                <dd>{bookingSuccess.doctorName || bookingSuccess.appointment?.doctor?.name || bookingSuccess.appointment?.doctor || "Hospital will assign one"}</dd>
                <dt>Reference</dt>
                <dd>{bookingSuccess.appointment?._id || "AFYA-" + Date.now().toString().slice(-6)}</dd>
              </dl>
            </div>
            <div className="appointment-success-summary">
              <strong>Care journey snapshot</strong>
              <div className="success-guide-panel" style={{ marginTop: 12 }}>
                <strong>Booking ownership</strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  {isMyHealthMode ? "This appointment is being booked for your personal health profile as a patient." : "This appointment is being booked from the current context."}
                </p>
              </div>
              <div className="patient-journey-list">
                {journeySteps.map((step) => (
                  <div key={step.key} className={`patient-journey-item ${step.status}`}>
                    <span className="patient-journey-dot" />
                    <div>
                      <div className="patient-journey-label">{step.label}</div>
                      <div className="patient-journey-description">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="success-guide-panel">
              <strong>This visit is now ready for</strong>
              <ul>
                <li>Preparation instructions tailored to your chosen consultation mode.</li>
                <li>Direct follow-up actions like joining a video call or contacting the hospital.</li>
                <li>Live updates as your care journey progresses through labs, pharmacy, and billing.</li>
              </ul>
            </div>
            <div className="appointment-success-actions">
              <button type="button" className="btn-primary" onClick={() => setBookingSuccess(null)}>
                Continue to checklist
              </button>
              <button type="button" className="btn-secondary" disabled={!aiRecommendationsEnabled} onClick={() => { setBookingSuccess(null); openAiAssistant(`Prepare me for my ${bookingSuccess.serviceType || "General Consultation"} appointment at ${bookingSuccess.hospitalName}. Suggest symptoms to track and questions to ask.`); }}>
                {aiRecommendationsEnabled ? "Open AI Assistant" : "AI Assistant Disabled"}
              </button>
              <button type="button" className="btn-secondary" disabled={!bookingSuccess.appointment?._id || !bookingSuccess.appointment?.doctor} onClick={async () => { const appointmentId = bookingSuccess.appointment?._id; setBookingSuccess(null); if (appointmentId) await startConsultation(appointmentId, "VIDEO"); }}>
                Join Video Call
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setBookingSuccess(null); document.getElementById("patient-appointments-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                View My Appointments
              </button>
            </div>
          </div>
        </div>
      )}

      {discoveryEnabled && !discoveryComplete ? (
        <div className="discovery-sequence-overlay" role="status" aria-live="polite">
          <div className="discovery-sequence-card">
            <div className="patient-discovery-radar" aria-label="Scanning nearby hospitals">
              <div className="patient-discovery-ring patient-discovery-ring-1" />
              <div className="patient-discovery-ring patient-discovery-ring-2" />
              <div className="patient-discovery-core" />
              <div className="patient-discovery-marker patient-discovery-marker-1" />
              <div className="patient-discovery-marker patient-discovery-marker-2" />
              <div className="patient-discovery-marker patient-discovery-marker-3" />
            </div>
            <div className="discovery-sequence-title">{["Locating you…", "GPS connected", "Scanning nearby hospitals…", "Checking available doctors…", "Building recommendations…"][discoveryStepIndex]}</div>
            <div className="discovery-sequence-subtitle">{discoveryStepIndex < 4 ? "The platform is preparing a tailored healthcare discovery view for you." : "Ready"}</div>
            <div className="discovery-progress-row">
              {[0, 1, 2, 3, 4].map((step) => (
                <div key={step} className={`discovery-progress-step ${step <= discoveryStepIndex ? "active" : ""}`} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {discoveryEnabled ? (
      <section className="section">
        <div className="card premium-card patient-discovery-shell">
          <div className="patient-discovery-header">
            <div>
              <div className="appointment-success-kicker">Step 1 · Discover hospitals</div>
              <h3>{t("chooseLocation", "Finding Healthcare Near You")}</h3>
              <p className="muted">We use your location to surface nearby hospitals, trusted doctors, and live appointment options in a premium discovery flow.</p>
            </div>
            <div className="patient-discovery-status-pill">
              {locating ? "Finding your location..." : locationReady ? "GPS ready" : "Scanning..."}
            </div>
          </div>

          <div className="patient-discovery-controls">
            <button type="button" className="btn-primary" onClick={useCurrentLocation} disabled={locating}>
              {locating ? t("detecting", "Detecting...") : t("currentLocation", "Use Current Location")}
            </button>
            <input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Search town, county, or landmark" />
            <input value={hospitalQuery} onChange={(e) => setHospitalQuery(e.target.value)} placeholder="Search hospital, specialty, doctor, county" />
          </div>

          <div className="patient-discovery-summary">
            <div className="patient-discovery-summary-item">
              <strong>{locationReady ? "GPS found" : "Finding your location..."}</strong>
              <span>{locationLabel || "Allow location access for best matches"}</span>
            </div>
            <div className="patient-discovery-summary-item">
              <strong>{hospitals.length} hospitals</strong>
              <span>within {radiusKm} km</span>
            </div>
          </div>

          {mapEnabled ? (
            <div className="patient-map-shell" ref={mapShellRef}>
              <div className="patient-map-layout">
                <div className="patient-map-main">
                  <div className="patient-map-toolbar">
                    <div className="appointment-success-kicker">live map</div>
                  </div>
                  <div className={`patient-map-canvas map-zoom-${mapZoom}`} aria-label="Interactive healthcare map">
                    <div className="patient-map-overlay" />
                    <div className="patient-map-satellite" aria-hidden="true" />
                    <button type="button" className="btn-secondary mobile-details-toggle" onClick={() => setIsMobileSheetOpen((prev) => !prev)}>
                      {isMobileSheetOpen ? "Hide details" : "View details"}
                    </button>
                    {mapsApiKey && !mapLoadError ? (
                      <div ref={mapContainerRef} className="patient-map-embed" />
                    ) : (
                      <iframe
                        title="Hospital map"
                        className="patient-map-embed"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(mapEmbedQuery)}&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    )}
                    {!showMapSelectionCard && !mapLoadError ? (
                      <div className="patient-map-empty-hint">Tap a hospital marker to view details</div>
                    ) : null}
                  </div>
                </div>

                <div className={`patient-map-sidepanel ${isPanelCollapsed ? "collapsed-panel" : ""}`}>
                  <div className="patient-map-sidepanel-inner">
                    <div className="patient-map-sidepanel-header">
                      <div>
                        <div className="appointment-success-kicker">details</div>
                        <div className="patient-map-sidepanel-note">Select a hospital marker on the map to review booking details.</div>
                      </div>
                      <div className="patient-map-control-group">
                        <button type="button" className="btn-secondary compact-btn" onClick={() => setMapZoom((prev) => Math.min(prev + 1, 3))} aria-label="Zoom in">+</button>
                        <button type="button" className="btn-secondary compact-btn" onClick={() => setMapZoom((prev) => Math.max(prev - 1, 1))} aria-label="Zoom out">−</button>
                        <button type="button" className="btn-secondary compact-btn" onClick={toggleFullscreen} aria-label={isMapFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                          {isMapFullscreen ? "Exit" : "Fullscreen"}
                        </button>
                        <button type="button" className="btn-secondary compact-btn hide-on-mobile" onClick={() => setIsPanelCollapsed((prev) => !prev)} aria-label={isPanelCollapsed ? "Show details panel" : "Hide details panel"}>
                          {isPanelCollapsed ? "▶" : "◀"}
                        </button>
                      </div>
                    </div>
                    <div className="patient-map-sidepanel-content">
                      {mapLoadError ? (
                        <div className="patient-map-detail-card patient-map-detail-card-sidepanel">
                          <strong>Live map unavailable</strong>
                          <p className="muted" style={{ margin: "6px 0 0" }}>{mapLoadError}</p>
                        </div>
                      ) : showMapSelectionCard && mapHospital ? (
                        <div
                          className={`patient-map-detail-card patient-map-detail-card-sidepanel ${isMapDetailExpanded ? "expanded" : "collapsed"} ${hoveredHospitalId === String(mapHospital._id) ? "highlighted" : ""} ${isHospitalInfoTransitioning ? "transitioning" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            if (event.target === event.currentTarget) {
                              pulseSelectedMarker(mapHospital._id);
                            }
                          }}
                        >
                          <button type="button" className="patient-map-detail-handle" onClick={() => setIsMapDetailExpanded((prev) => !prev)}>
                            <span className="patient-map-detail-handle-pill" />
                            <span>{isMapDetailExpanded ? "Hide details" : `Hospital details · ${mapHospital.name}`}</span>
                            <span>{isMapDetailExpanded ? "▼" : "▲"}</span>
                          </button>
                          {isMapDetailExpanded ? (
                            <div className="patient-map-detail-body" onMouseEnter={() => setHoveredHospitalId(String(mapHospital._id))} onMouseLeave={() => setHoveredHospitalId("")}> 
                              <div className="patient-map-detail-head">
                                <strong className="patient-map-detail-title">{mapHospital.name}</strong>
                                <span className="patient-discovery-status-pill">{mapHospitalDistance}</span>
                              </div>
                              <div className="patient-map-detail-meta">
                                <span className="hospital-discovery-pill">Open</span>
                                <span className="hospital-discovery-pill">{Number.isFinite(Number(mapHospital?.distanceKm)) ? `${Number(mapHospital.distanceKm).toFixed(1)} km` : "Near you"}</span>
                              </div>
                              <p className="muted" style={{ margin: "6px 0 0" }}>{mapHospital.address || "Verified care near you"}</p>
                              {routeSummary ? (
                                <div className="patient-map-route-summary">Driving {routeSummary.duration || ""} • {routeSummary.distance || ""}</div>
                              ) : null}
                              <div className="patient-map-detail-actions patient-map-detail-actions-fullwidth">
                                <button type="button" className="btn-primary full-width" onClick={() => document.getElementById("patient-booking-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Book Appointment</button>
                                <button type="button" className="btn-secondary full-width" onClick={handleViewRoute}>View Route</button>
                              </div>
                            </div>
                          ) : (
                            <div className="patient-map-detail-collapsed" onMouseEnter={() => setHoveredHospitalId(String(mapHospital._id))} onMouseLeave={() => setHoveredHospitalId("")}>
                              <strong className="patient-map-detail-title">{mapHospital.name}</strong>
                              <span className="muted">Tap to view details</span>
                            </div>
                          )}
                        </div>
                      ) : loading ? (
                        <div className="patient-map-detail-card patient-map-detail-card-sidepanel patient-map-skeleton-card">
                          <div className="skeleton-line skeleton-title" />
                          <div className="skeleton-line skeleton-text" />
                          <div className="skeleton-line skeleton-text short" />
                          <div className="skeleton-buttons">
                            <div className="skeleton-pill" />
                            <div className="skeleton-pill" />
                          </div>
                        </div>
                      ) : (
                        <div className="patient-map-detail-card patient-map-detail-card-sidepanel">
                          <strong>Select a hospital on the map to view details and book an appointment.</strong>
                          <p className="muted" style={{ margin: "8px 0 0" }}>The details panel updates as you choose a provider.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state-panel" style={{ marginTop: 12 }}>
              <strong>Discovery map is currently disabled for this environment.</strong>
              <p className="muted">You can still continue booking from the hospital cards and selected hospital summary.</p>
            </div>
          )}
        </div>
      </section>
      ) : null}

      <section className="section">
        <div className="card premium-card">
          <div className="card-title-row" style={{ marginBottom: 12 }}>
            <div>
              <div className="action-card-eyebrow">Step 2 · Select hospital</div>
              <h3 style={{ margin: 0 }}>{t("selectHospitalTitle", "Nearby Hospitals")}</h3>
              <p className="muted" style={{ margin: "4px 0 0" }}>The map stays front and center while the nearby hospital list remains compact and expandable.</p>
            </div>
            <div className="patient-map-toolbar-actions">
              {hospitals.length > 3 && hospitalDrawerEnabled ? (
                <button type="button" className="btn-secondary" onClick={() => setShowNearbyHospitalsList((prev) => !prev)}>
                  {showNearbyHospitalsList ? "Hide Nearby List" : `Nearby Hospitals (${hospitals.length})`}
                </button>
              ) : null}
              {hospitals.length > 3 && hospitalDrawerEnabled ? (
                <button type="button" className="btn-secondary" onClick={() => setShowAllHospitalsDrawer((prev) => !prev)}>
                  {showAllHospitalsDrawer ? "Hide Full List" : `View All Hospitals (${hospitals.length})`}
                </button>
              ) : null}
            </div>
          </div>
          {showNearbyHospitalsList || !hospitals.length ? (
            <div className="patient-hospital-grid">
              {loading && !hospitals.length ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="patient-hospital-card skeleton-card" aria-hidden="true">
                    <div className="skeleton skeleton-line" style={{ width: "52%", height: 12, marginBottom: 8 }} />
                    <div className="skeleton skeleton-line" style={{ width: "84%", height: 10, marginBottom: 6 }} />
                    <div className="skeleton skeleton-pill" style={{ width: "64%", marginBottom: 8 }} />
                    <div className="skeleton skeleton-pill" style={{ width: "46%" }} />
                  </div>
                ))
              ) : null}
              {!loading && displayHospitals.map((hospital, index) => {
                const isSelected = String(hospital._id) === selectedHospitalId;
                const distanceLabel = Number.isFinite(Number(hospital.distanceKm)) ? `${Number(hospital.distanceKm).toFixed(1)} km away` : "Nearby";
                const recommendation = getHospitalRecommendation(hospital, index);
                const badges = [
                  hospital?.verification?.badgeLabel || hospital?.isVerified ? "Verified" : null,
                  hospital?.isLive ? "Open" : null,
                  hospital?.services?.includes("Emergency") || hospital?.emergencyServices ? "Emergency" : null,
                  hospital?.consultationModes?.includes("VIDEO") || hospital?.multiModal?.video ? "Video" : null,
                  Number.isFinite(Number(hospital.distanceKm)) && Number(hospital.distanceKm) <= 5 ? "Near you" : null,
                ].filter(Boolean);
                const visibleBadges = badges.slice(0, 3);
                const hiddenBadgeCount = Math.max(0, badges.length - visibleBadges.length);
                return (
                  <button key={hospital._id} type="button" className={`patient-hospital-card ${isSelected ? "selected" : ""}`} onClick={() => handleSelectHospital(hospital._id)}>
                    <div className="patient-hospital-head">
                      <div className="patient-hospital-main-title">
                        <strong>{hospital.name}</strong>
                        <span className="muted patient-hospital-address">{hospital.address || "Verified care near you"}</span>
                      </div>
                      <span className="patient-discovery-status-pill">{distanceLabel}</span>
                    </div>
                    <div className="patient-hospital-rating-row">
                      <span className="patient-hospital-pill">★ {hospital.rating || "4.9"}</span>
                      <span className="patient-hospital-pill accent-pill">AI Match {recommendation.score}%</span>
                    </div>
                    <div className="patient-hospital-tags">
                      {visibleBadges.map((badge) => (
                        <span key={badge} className="hospital-discovery-pill">{badge}</span>
                      ))}
                      {hiddenBadgeCount > 0 ? <span className="hospital-discovery-pill">+{hiddenBadgeCount} more</span> : null}
                    </div>
                    <div className="patient-hospital-actions">
                      <span className="btn-secondary compact-btn">{isSelected ? "Selected" : "Continue"}</span>
                    </div>
                  </button>
                );
              })}
              {!loading && !hospitals.length && (
                <div className="card premium-card" style={{ gridColumn: "1 / -1" }}>
                  <p className="muted">We are still scanning. Your current location and search terms will surface hospitals shortly.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
        {hospitalDrawerEnabled && showAllHospitalsDrawer ? (
          <div className="patient-hospital-drawer" role="dialog" aria-label="All hospitals">
            <div className="patient-hospital-drawer-head">
              <strong>All Hospitals</strong>
              <button type="button" className="btn-secondary" onClick={() => setShowAllHospitalsDrawer(false)}>Close</button>
            </div>
            <div className="patient-hospital-drawer-controls">
              <input value={hospitalQuery} onChange={(e) => setHospitalQuery(e.target.value)} placeholder="Search hospitals" />
              <select value={hospitalSortMode} onChange={(e) => setHospitalSortMode(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
              </select>
            </div>
            <div className="patient-hospital-drawer-list">
              {sortedHospitals.map((hospital) => (
                <button key={hospital._id} type="button" className={`patient-hospital-drawer-item ${String(hospital._id) === selectedHospitalId ? "selected" : ""}`} onClick={() => handleSelectHospital(hospital._id)}>
                  <div>
                    <strong>{hospital.name}</strong>
                    <div className="muted small-text">{hospital.address || "Verified care near you"}</div>
                  </div>
                  <span className="patient-discovery-status-pill">{Number.isFinite(Number(hospital.distanceKm)) ? `${Number(hospital.distanceKm).toFixed(1)} km` : "Nearby"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {selectedHospital ? (
        <section className="section">
          <div className="card premium-card selected-hospital-card">
            <div className="selected-hospital-top">
              <div>
                <div className="action-card-eyebrow">Step 3 · Selected hospital</div>
                <h3 style={{ margin: 0 }}>{selectedHospital.name}</h3>
                <p className="muted" style={{ margin: "4px 0 0" }}>{selectedHospital.address || "Trusted healthcare provider nearby"}</p>
              </div>
              <div className="patient-hospital-badge-stack">
                <span className="patient-discovery-status-pill">✓ Selected</span>
                <span className="patient-discovery-status-pill">{Number.isFinite(Number(selectedHospital.distanceKm)) ? `${Number(selectedHospital.distanceKm).toFixed(1)} km away` : "Nearby"}</span>
              </div>
            </div>
            <div className="patient-hospital-tags">
              <span className="hospital-discovery-pill">Verified</span>
              <span className="hospital-discovery-pill">Open</span>
              <span className="hospital-discovery-pill">Video</span>
            </div>
            <div className="selected-hospital-actions">
              <button type="button" className="btn-primary" onClick={() => document.getElementById("patient-booking-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Continue Booking</button>
              {directionsHref ? (
                <a className="btn-secondary compact-btn" href={directionsHref} target="_blank" rel="noreferrer noopener">Directions</a>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => setHospitalId("")}>Change Hospital</button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <h3> {t("bookAppointmentStep", "Book Appointment")}</h3>
        <form id="patient-booking-form" className="card premium-card" onSubmit={submit}>
          {!selectedHospital ? (
            <div className="empty-state-panel" style={{ marginBottom: 12 }}>
              <strong>Select a hospital from the discovery cards above to unlock booking.</strong>
            </div>
          ) : null}
          <label>{t("serviceType", "Service Type")}</label>
          <select
            value={form.serviceType}
            onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value }))}
            data-ai-label="Appointment Service"
            data-ai-aliases="service type|consultation service|clinic service"
            data-ai-priority="high"
          >
            <option value="General Consultation">General Consultation</option>
            <option value="Outpatient Review">Outpatient Review</option>
            <option value="Paediatrics">Paediatrics</option>
            <option value="Antenatal Care">Antenatal Care</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Surgery Review">Surgery Review</option>
            <option value="Physiotherapy">Physiotherapy</option>
            <option value="Mental Health">Mental Health</option>
          </select>
          <label>{t("preferredDate", "Preferred date & time")}</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
            required
            data-ai-label="Appointment Date & Time"
            data-ai-aliases="appointment time|scheduled time|booking date and time"
            data-ai-priority="high"
          />
          <label>{t("consultationMode", "Consultation mode")}</label>
          <select
            value={form.consultationMode}
            onChange={(e) => setForm((p) => ({ ...p, consultationMode: e.target.value }))}
            data-ai-label="Consultation Type"
            data-ai-aliases="consultation mode|appointment mode|visit mode"
            data-ai-priority="high"
          >
            <option value="IN_PERSON">In person</option>
            <option value="CHAT">Chat</option>
            <option value="VOICE">Voice call</option>
            <option value="VIDEO">Video call</option>
          </select>
          <label>{t("reason", "Reason")}</label>
          <input
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Consultation reason"
            data-ai-label="Appointment Reason"
            data-ai-aliases="consultation reason|visit reason|chief complaint"
            data-ai-priority="high"
          />
          <label>{t("preferredDoctorOptional", "Preferred doctor (optional)")}</label>
          <input
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            placeholder="Search doctor by name, email or department"
            data-ai-label="Doctor Search"
            data-ai-aliases="doctor lookup|find doctor|preferred doctor search"
            data-ai-intent="lookup"
            data-ai-priority="medium"
          />
          <select
            value={form.doctor}
            onChange={(e) => setForm((p) => ({ ...p, doctor: e.target.value }))}
            data-ai-label="Preferred Doctor"
            data-ai-aliases="doctor|selected doctor|assigned doctor"
            data-ai-widget="doctor-picker"
            data-ai-priority="high"
          >
            <option value="">Any available doctor</option>
            {filteredDoctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} {d?.employment?.department ? `• ${d.employment.department}` : ""}
              </option>
            ))}
          </select>
          <p className="muted" style={{ marginTop: 6 }}>
            The hospital will assign the best available doctor if you leave this blank.
          </p>
          {bookingLocked ? (
            <div className="appointment-lock-card" role="status" style={{ marginBottom: 12 }}>
              <strong>You're already scheduled today</strong>
              <p style={{ margin: "8px 0 0" }}>
                {activeBookingLock?.message || "Good news! You already have an appointment booked for today."}
              </p>
              <p style={{ margin: "8px 0 0" }}>
                You can make another appointment tomorrow after midnight: <strong>{formatDateTime(activeBookingLock.nextAvailableAt)}</strong>
              </p>
              <p style={{ margin: "8px 0 0" }}>
                Need help before then? Use the AI Assistant or request an online doctor from your appointment.
              </p>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => showDailyLimitNotice(activeBookingLock)}
              >
                View My Options
              </button>
            </div>
          ) : null}
          <button type="submit" className="btn-primary" disabled={saving || bookingLocked || !selectedHospital}>
            {saving ? t("submitting", "Submitting...") : bookingLocked ? "Already Scheduled Today" : selectedHospital ? t("bookNow", "Book Now") : "Select a hospital first"}
          </button>
        </form>
      </section>

      <section className="section">
        <div className="card-title-row">
          <div>
            <div className="action-card-eyebrow">Step 4 · Choose appointment</div>
            <h3 style={{ margin: 0 }}>{t("suggestions", "Suggested Slots")}</h3>
          </div>
        </div>
        <div className="patient-slot-sections">
          {Object.entries(suggestedSlotsBySection).map(([label, items]) => (
            <div key={label} className="patient-slot-section">
              <div className="patient-slot-section-title">{label}</div>
              <div className="patient-slot-chip-row">
                {items.map((item, index) => {
                  const slotDate = item?.appointmentTime ? new Date(item.appointmentTime) : null;
                  const slotLabel = formatSlotLabel(slotDate);
                  return (
                    <div key={`${item.doctorId}-${index}`} className="patient-slot-chip-card">
                      <div className="patient-slot-chip-time">{slotLabel}</div>
                      <div className="patient-slot-chip-meta">{item.doctorName || "Available doctor"}</div>
                      <button type="button" className="btn-secondary compact-btn" onClick={() => {
                        const localValue = slotDate && !Number.isNaN(slotDate.getTime()) ? new Date(slotDate.getTime() - slotDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
                        setForm((prev) => ({ ...prev, doctor: item.doctorId, scheduledAt: localValue || prev.scheduledAt }));
                      }}>
                        Select
                      </button>
                    </div>
                  );
                })}
                {!items.length && (
                  <div className="empty-state-panel compact-empty">
                    <strong>No {label.toLowerCase()} slots yet.</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!suggestions.length && (
            <div className="empty-state-panel">
              <strong>{t("noSuggestedSlots", "No smart slot suggestions yet.")}</strong>
              <p className="muted">Pick a time manually or adjust your preferred service to surface new recommendations.</p>
            </div>
          )}
        </div>
      </section>

      {doctorMarketplaceEnabled ? (
      <section className="section">
        <div className="card-title-row">
          <div>
            <div className="action-card-eyebrow">Step 3 · Select doctor</div>
            <h3 style={{ margin: 0 }}>{t("doctorsInHospital", "Doctor Discovery")}</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>Browse doctors by specialty, language, availability, and consultation mode, then choose a preferred clinician.</p>
          </div>
        </div>
        <div className="card premium-card doctor-discovery-filters">
          <select value={doctorFilters.specialty} onChange={(event) => setDoctorFilters((prev) => ({ ...prev, specialty: event.target.value }))}>
            <option value="">Any specialty</option>
            <option value="Cardiology">Cardiology</option>
            <option value="General">General</option>
            <option value="Neurology">Neurology</option>
            <option value="Pediatrics">Pediatrics</option>
          </select>
          <select value={doctorFilters.language} onChange={(event) => setDoctorFilters((prev) => ({ ...prev, language: event.target.value }))}>
            <option value="">Any language</option>
            <option value="English">English</option>
            <option value="Swahili">Swahili</option>
            <option value="French">French</option>
          </select>
          <select value={doctorFilters.gender} onChange={(event) => setDoctorFilters((prev) => ({ ...prev, gender: event.target.value }))}>
            <option value="">Any gender</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
          <select value={doctorFilters.availability} onChange={(event) => setDoctorFilters((prev) => ({ ...prev, availability: event.target.value }))}>
            <option value="">Any availability</option>
            <option value="available">Available today</option>
            <option value="busy">Busy</option>
          </select>
          <select value={doctorFilters.consultationMode} onChange={(event) => setDoctorFilters((prev) => ({ ...prev, consultationMode: event.target.value }))}>
            <option value="">Any mode</option>
            <option value="VIDEO">Video</option>
            <option value="VOICE">Voice</option>
            <option value="IN_PERSON">In-person</option>
          </select>
          <select value={doctorFilters.insurance} onChange={(event) => setDoctorFilters((prev) => ({ ...prev, insurance: event.target.value }))}>
            <option value="">Any insurance</option>
            <option value="accepted">Insurance accepted</option>
            <option value="not-accepted">Not accepted</option>
          </select>
        </div>
        <div className="grid info-grid">
          {filteredDoctorsForDiscovery.slice(0, 8).map((doctor, index) => {
            const availability = getDoctorAvailability(doctor);
            const recommendation = getDoctorRecommendation(doctor, index);
            return (
              <div key={doctor._id} className="card premium-card doctor-discovery-card">
                <div className="doctor-discovery-head">
                  <div className="doctor-avatar">{String(doctor.name || "Dr").charAt(0)}</div>
                  <div>
                    <h4 style={{ marginTop: 0 }}>{doctor.name}</h4>
                    <p className="muted" style={{ marginBottom: 8 }}>{doctor.specialization || doctor?.employment?.department || "General Practice"}</p>
                  </div>
                </div>
                <div className="doctor-discovery-meta">
                  <span>{doctor.yearsOfExperience || 8}+ yrs</span>
                  <span>{(doctor.languages || ["English"]).join(", ")}</span>
                </div>
                <div className="doctor-discovery-badges">
                  <span className={`action-pill ${availability.tone}`}>{availability.label}</span>
                  <span className="action-pill connected">Best Match {recommendation.score}%</span>
                </div>
                <div className="patient-hospital-tags">
                  {doctor.consultationMode?.includes("VIDEO") ? <span className="hospital-discovery-pill">Video</span> : null}
                  {doctor.consultationMode?.includes("VOICE") ? <span className="hospital-discovery-pill">Voice</span> : null}
                  {doctor.consultationMode?.includes("IN_PERSON") ? <span className="hospital-discovery-pill">In-person</span> : null}
                </div>
                <button type="button" className="btn-primary" onClick={() => setForm((p) => ({ ...p, doctor: doctor._id }))} style={{ marginTop: 12 }}>
                  {t("preferDoctor", "Book")}
                </button>
              </div>
            );
          })}
          {!filteredDoctorsForDiscovery.length && (
            <div className="empty-state-panel">
              <strong>{t("noDoctorsListed", "No doctors match the current filters yet.")}</strong>
              <p className="muted">Try clearing one of the filters or selecting a different hospital to view available clinicians.</p>
            </div>
          )}
        </div>
      </section>
      ) : null}

      <section className="section">
        <div className="card-title-row">
          <div>
            <div className="action-card-eyebrow">History</div>
            <h3 style={{ margin: 0 }}>Consultation History</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>Completed voice and video consultations are archived here. Active calls appear in the Calls button in the top bar.</p>
          </div>
        </div>
        <div className="card premium-card consultation-history-card">
          {consultationHistory.map((call) => (
            <div key={call._id} className="consultation-history-row">
              <div>
                <span className="telehealth-kicker">{getHistoryDayLabel(call)}</span>
                <strong>{call.callType === "VIDEO" ? "Video Consultation" : "Voice Consultation"}</strong>
                <p className="muted">
                  {call.doctor?.name || "Assigned doctor"} • {call.appointment?.serviceType || "General Consultation"}
                </p>
              </div>
              <span className="action-pill connected">Completed</span>
            </div>
          ))}
          {!consultationHistory.length ? (
            <div className="empty-state-panel">
              <strong>No completed consultations yet.</strong>
              <p className="muted">When an online doctor consultation ends, it will move here automatically.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section">
        <div className="card-title-row">
          <div>
            <div className="action-card-eyebrow">Appointments</div>
            <h3 id="patient-appointments-list" style={{ margin: 0 }}>{t("recentAppointments", "Recent Appointments")}</h3>
          </div>
        </div>
        <div className="card premium-card">
          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Scheduled At</th>
                    <th>Status</th>
                    <th>Service</th>
                    <th>Reason</th>
                    <th>Doctor</th>
                    <th>Notes</th>
                    <th>Call</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a._id}>
                      <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "—"}</td>
                      <td>{a.status || "Scheduled"}</td>
                      <td>{a.serviceType || "General Consultation"}</td>
                      <td>{a.reason || "—"}</td>
                      <td>{a.doctor?.name || a.doctor || "Unassigned"}</td>
                      <td>
                        {a.notes
                          ? `${String(a.notes).slice(0, 100)}${String(a.notes).length > 100 ? "..." : ""}`
                          : a?.metadata?.followUpRequired
                          ? "Follow-up planned"
                          : "—"}
                        {a?.metadata?.consultationSummary?.diagnosis ? (
                          <div className="muted" style={{ marginTop: 4 }}>
                            Dx: {a.metadata.consultationSummary.diagnosis}
                          </div>
                        ) : null}
                        {a?.metadata?.consultationSummary?.followUpDate ? (
                          <div className="muted">
                            Follow-up: {new Date(a.metadata.consultationSummary.followUpDate).toLocaleDateString()}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="doctor-actions-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={!a.doctor}
                            data-ai-action="start-voice-consultation"
                            data-ai-label="Start Voice Consultation"
                            data-ai-aliases="voice call|start voice|request voice consultation"
                            data-ai-help={`${a.doctor?.name || a.doctor || "Assigned doctor"} | ${a.serviceType || "General Consultation"} | ${a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "No scheduled time"}`}
                            onClick={() => startConsultation(a._id, "VOICE")}
                          >
                            {t("voice", "Voice")}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={!a.doctor}
                            data-ai-action="start-video-consultation"
                            data-ai-label="Start Video Consultation"
                            data-ai-aliases="video call|start video|request video consultation"
                            data-ai-help={`${a.doctor?.name || a.doctor || "Assigned doctor"} | ${a.serviceType || "General Consultation"} | ${a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "No scheduled time"}`}
                            onClick={() => startConsultation(a._id, "VIDEO")}
                          >
                            {t("video", "Video")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {appointments.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state-panel">
                          <strong>{t("noAppointmentsYet", "No appointments yet.")}</strong>
                          <p className="muted">Your recent bookings and follow-up actions will appear here once you schedule a visit.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
