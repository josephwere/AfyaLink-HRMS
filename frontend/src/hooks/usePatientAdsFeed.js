import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  applyToRecruitmentAd,
  listRecruitmentAds,
  listRecruitmentApplications,
  trackRecruitmentAdEvent,
} from "../services/recruitmentAdsApi";
import { usePatientLanguage } from "../utils/patientLanguage.jsx";

const emptyApplicationForm = {
  fullName: "",
  email: "",
  phone: "",
  coverLetter: "",
  resumeUrl: "",
  experienceSummary: "",
  privateAccessToken: "",
};

function buildApplicationPayload(form, resumeFile) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      data.append(key, value);
    }
  });
  if (resumeFile) data.append("resumeFile", resumeFile);
  return data;
}

export function usePatientAdsFeed({ variant = "app", defaultSource = "PATIENT_FEED", locationSearch = "" } = {}) {
  const { t } = usePatientLanguage();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [applyingId, setApplyingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [form, setForm] = useState(emptyApplicationForm);
  const [openAdId, setOpenAdId] = useState("");
  const source = useMemo(() => {
    const params = new URLSearchParams(locationSearch || location.search || "");
    return String(params.get("src") || defaultSource || "PATIENT_FEED").trim().toUpperCase();
  }, [defaultSource, location.search, locationSearch]);

  const loadAds = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [listRecruitmentAds({ q, limit: 100, source })];
      if (variant !== "public") {
        requests.push(listRecruitmentApplications({ mine: 1, limit: 200 }));
      }
      const [adsData, appData] = await Promise.all(requests);
      setAds(Array.isArray(adsData?.items) ? adsData.items : []);
      setApplications(
        variant === "public"
          ? []
          : Array.isArray(appData?.items)
          ? appData.items
          : []
      );
    } catch (e) {
      setMsg(e?.message || "Failed to load vacancies");
      setAds([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [q, source, variant]);

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const appByAdId = useMemo(() => {
    const map = new Map();
    applications.forEach((a) => {
      const adId = String(a?.ad?._id || a?.ad || "");
      if (adId) map.set(adId, a);
    });
    return map;
  }, [applications]);

  const startApply = useCallback((adId) => {
    setApplyingId(adId);
    setOpenAdId(adId);
    setResumeFile(null);
    setMsg("");
    void trackRecruitmentAdEvent(adId, { event: "APPLY_INTENT", source });
  }, [source]);

  const cancelApply = useCallback(() => {
    setApplyingId("");
    setResumeFile(null);
    setForm(emptyApplicationForm);
  }, []);

  const submitApplication = useCallback(async (adId) => {
    setSubmitting(true);
    setMsg("");
    try {
      const payload = buildApplicationPayload({ ...form, source }, resumeFile);
      await applyToRecruitmentAd(adId, payload);
      setMsg("Application submitted.");
      cancelApply();
      await loadAds();
    } catch (e) {
      setMsg(e?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  }, [cancelApply, form, loadAds, resumeFile, source]);

  const trackAndFollow = useCallback((adId, event) => () => {
    void trackRecruitmentAdEvent(adId, { event, source });
  }, [source]);

  const toggleOpenAd = useCallback((adId) => {
    setOpenAdId((prev) => (String(prev) === String(adId) ? "" : String(adId)));
  }, []);

  return {
    t,
    q,
    setQ,
    ads,
    applications,
    loading,
    msg,
    setMsg,
    applyingId,
    setApplyingId,
    submitting,
    setSubmitting,
    resumeFile,
    setResumeFile,
    form,
    setForm,
    openAdId,
    setOpenAdId,
    source,
    appByAdId,
    loadAds,
    startApply,
    cancelApply,
    submitApplication,
    trackAndFollow,
    toggleOpenAd,
  };
}

export default usePatientAdsFeed;
