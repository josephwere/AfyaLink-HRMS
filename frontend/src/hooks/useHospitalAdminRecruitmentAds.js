import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRecruitmentAd,
  listRecruitmentAds,
  listRecruitmentApplications,
  updateRecruitmentAd,
  updateRecruitmentApplicationStatus,
} from "../services/recruitmentAdsApi";

const emptyForm = {
  title: "",
  role: "",
  department: "",
  employmentType: "FULL_TIME",
  workMode: "ONSITE",
  location: "",
  salaryRange: "",
  hiringCount: 1,
  seniorityLevel: "",
  description: "",
  campaignSummary: "",
  bannerHeadline: "",
  bannerSubheadline: "",
  requirements: "",
  benefits: "",
  highlights: "",
  tags: "",
  contactEmail: "",
  contactPhone: "",
  applyUrl: "",
  careersPageUrl: "",
  videoUrl: "",
  bannerLink: "",
  brochureUrl: "",
  applicationMode: "INTERNAL",
  visibility: "PUBLIC",
  featured: false,
  priority: 50,
  campaignStartAt: "",
  expiresAt: "",
};

const sourceLabels = {
  LOGIN_PAGE: "Login",
  REGISTER_PAGE: "Register",
  PATIENT_DASHBOARD: "Patient Dashboard",
  PATIENT_FEED: "Patient Feed",
  DIRECT_CAREERS: "Direct Careers",
};

function formatSourceLabel(source) {
  return sourceLabels[source] || String(source || "").replace(/_/g, " ");
}

function appendFormData(form, coverImage, galleryImages) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "boolean") {
      data.append(key, value ? "true" : "false");
      return;
    }
    if (String(value) !== "") data.append(key, String(value));
  });
  if (coverImage) data.append("coverImage", coverImage);
  Array.from(galleryImages || []).forEach((file) => data.append("galleryImages", file));
  return data;
}

export function useHospitalAdminRecruitmentAds() {
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [coverImage, setCoverImage] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [editingAdId, setEditingAdId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [adFilter, setAdFilter] = useState("");

  const loadRecruitmentData = useCallback(async () => {
    setLoading(true);
    try {
      const [adsData, appsData] = await Promise.all([
        listRecruitmentAds({ page: 1, limit: 100 }),
        listRecruitmentApplications({ page: 1, limit: 300 }),
      ]);
      setAds(Array.isArray(adsData?.items) ? adsData.items : []);
      setApplications(Array.isArray(appsData?.items) ? appsData.items : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load recruitment data");
      setAds([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecruitmentData();
  }, [loadRecruitmentData]);

  const createRecruitmentCampaign = useCallback(async (payload, options = {}) => {
    setSaving(true);
    setMsg("");
    try {
      if (editingAdId) {
        await updateRecruitmentAd(editingAdId, payload);
        setMsg("Recruitment campaign updated.");
      } else {
        await createRecruitmentAd(payload);
        setMsg("Recruitment campaign published.");
      }
      setForm(emptyForm);
      setCoverImage(null);
      setGalleryImages([]);
      setEditingAdId("");
      await loadRecruitmentData();
      return true;
    } catch (err) {
      setMsg(err?.message || "Failed to save recruitment campaign");
      return false;
    } finally {
      setSaving(false);
    }
  }, [editingAdId, loadRecruitmentData]);

  const updateAdStatus = useCallback(async (id, status) => {
    try {
      const data = new FormData();
      data.append("status", status);
      await updateRecruitmentAd(id, data);
      await loadRecruitmentData();
    } catch (err) {
      setMsg(err?.message || "Failed to update ad");
    }
  }, [loadRecruitmentData]);

  const startEdit = useCallback((ad) => {
    setEditingAdId(ad._id);
    setForm({
      title: ad.title || "",
      role: ad.role || "",
      department: ad.department || "",
      employmentType: ad.employmentType || "FULL_TIME",
      workMode: ad.workMode || "ONSITE",
      location: ad.location || "",
      salaryRange: ad.salaryRange || "",
      hiringCount: ad.hiringCount || 1,
      seniorityLevel: ad.seniorityLevel || "",
      description: ad.description || "",
      campaignSummary: ad.campaignSummary || "",
      bannerHeadline: ad.bannerHeadline || "",
      bannerSubheadline: ad.bannerSubheadline || "",
      requirements: (ad.requirements || []).join("\n"),
      benefits: (ad.benefits || []).join("\n"),
      highlights: (ad.highlights || []).join("\n"),
      tags: (ad.tags || []).join(", "),
      contactEmail: ad.contactEmail || "",
      contactPhone: ad.contactPhone || "",
      applyUrl: ad.applyUrl || "",
      careersPageUrl: ad.careersPageUrl || "",
      videoUrl: ad.videoUrl || "",
      bannerLink: ad?.media?.bannerLink || "",
      brochureUrl: ad?.media?.brochureUrl || "",
      applicationMode: ad.applicationMode || "INTERNAL",
      visibility: ad.visibility || "PUBLIC",
      featured: Boolean(ad.featured),
      priority: ad.priority || 50,
      campaignStartAt: ad.campaignStartAt ? String(ad.campaignStartAt).slice(0, 10) : "",
      expiresAt: ad.expiresAt ? String(ad.expiresAt).slice(0, 10) : "",
    });
    setMsg(`Editing campaign: ${ad.title}`);
  }, []);

  const resetEditor = useCallback(() => {
    setEditingAdId("");
    setForm(emptyForm);
    setCoverImage(null);
    setGalleryImages([]);
  }, []);

  const updateApplicationStatus = useCallback(async (applicationId, status) => {
    try {
      await updateRecruitmentApplicationStatus(applicationId, status);
      await loadRecruitmentData();
    } catch (err) {
      setMsg(err?.message || "Failed to update application status");
    }
  }, [loadRecruitmentData]);

  const filteredApplications = useMemo(() => applications.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (adFilter && String(a?.ad?._id || a?.ad) !== String(adFilter)) return false;
    return true;
  }), [adFilter, applications, statusFilter]);

  const applicationStatsByAd = useMemo(() => {
    const map = new Map();
    applications.forEach((item) => {
      const adId = String(item?.ad?._id || item?.ad || "");
      if (!adId) return;
      const row = map.get(adId) || { total: 0, shortlisted: 0, hired: 0, underReview: 0 };
      row.total += 1;
      if (item.status === "SHORTLISTED") row.shortlisted += 1;
      if (item.status === "HIRED") row.hired += 1;
      if (item.status === "UNDER_REVIEW") row.underReview += 1;
      map.set(adId, row);
    });
    return map;
  }, [applications]);

  const dashboardStats = useMemo(() => {
    const featured = ads.filter((ad) => ad.featured).length;
    const externalReady = ads.filter((ad) => ad.applicationMode === "EXTERNAL" || ad.applicationMode === "HYBRID").length;
    const totalApplicants = applications.length;
    const shortlisted = applications.filter((item) => item.status === "SHORTLISTED").length;
    const hired = applications.filter((item) => item.status === "HIRED").length;
    return { campaigns: ads.length, featured, externalReady, totalApplicants, shortlisted, hired };
  }, [ads, applications]);

  const sourcePerformance = useMemo(() => {
    const sourceMap = new Map();
    ads.forEach((ad) => {
      const sourceAttribution = ad?.analytics?.sourceAttribution || {};
      const eventSourceAttribution = ad?.analytics?.eventSourceAttribution || {};
      Object.entries(sourceAttribution).forEach(([sourceKey, views]) => {
        const row = sourceMap.get(sourceKey) || {
          source: sourceKey,
          views: 0,
          applyIntent: 0,
          internalApply: 0,
          externalClick: 0,
          careersClick: 0,
          brochureClick: 0,
          videoClick: 0,
          bannerClick: 0,
        };
        row.views += Number(views || 0);
        row.applyIntent += Number(eventSourceAttribution?.applyIntentCount?.[sourceKey] || 0);
        row.internalApply += Number(eventSourceAttribution?.internalApplyCount?.[sourceKey] || 0);
        row.externalClick += Number(eventSourceAttribution?.externalClickCount?.[sourceKey] || 0);
        row.careersClick += Number(eventSourceAttribution?.careersPageClickCount?.[sourceKey] || 0);
        row.brochureClick += Number(eventSourceAttribution?.brochureClickCount?.[sourceKey] || 0);
        row.videoClick += Number(eventSourceAttribution?.videoClickCount?.[sourceKey] || 0);
        row.bannerClick += Number(eventSourceAttribution?.bannerClickCount?.[sourceKey] || 0);
        sourceMap.set(sourceKey, row);
      });
    });
    const rows = Array.from(sourceMap.values()).map((row) => {
      const applyIntentRate = row.views ? (row.applyIntent / row.views) * 100 : 0;
      const conversionRate = row.views ? (row.internalApply / row.views) * 100 : 0;
      return { ...row, applyIntentRate, conversionRate };
    }).sort((a, b) => b.views - a.views);
    const totals = rows.reduce((acc, row) => {
      acc.views += row.views;
      acc.applyIntent += row.applyIntent;
      acc.internalApply += row.internalApply;
      acc.externalClick += row.externalClick;
      return acc;
    }, { views: 0, applyIntent: 0, internalApply: 0, externalClick: 0 });
    return { rows, totals };
  }, [ads]);

  const coverPreview = coverImage ? URL.createObjectURL(coverImage) : "";
  const galleryPreview = Array.from(galleryImages || []).map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));

  return {
    ads,
    applications,
    loading,
    saving,
    msg,
    setMsg,
    form,
    setForm,
    coverImage,
    setCoverImage,
    galleryImages,
    setGalleryImages,
    editingAdId,
    setEditingAdId,
    statusFilter,
    setStatusFilter,
    adFilter,
    setAdFilter,
    loadRecruitmentData,
    createRecruitmentCampaign,
    updateAdStatus,
    startEdit,
    resetEditor,
    updateApplicationStatus,
    filteredApplications,
    applicationStatsByAd,
    dashboardStats,
    sourcePerformance,
    coverPreview,
    galleryPreview,
    emptyForm,
    formatSourceLabel,
    appendFormData,
  };
}

export default useHospitalAdminRecruitmentAds;
