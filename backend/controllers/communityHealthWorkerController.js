import Household from "../models/Household.js";
import HouseholdMember from "../models/HouseholdMember.js";
import FieldVisit from "../models/FieldVisit.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import MaternalRecord from "../models/MaternalRecord.js";
import ChildGrowthRecord from "../models/ChildGrowthRecord.js";
import ChronicPatientLog from "../models/ChronicPatientLog.js";
import DiseaseReport from "../models/DiseaseReport.js";
import ChwReferral from "../models/ChwReferral.js";
import ChwPerformanceLog from "../models/ChwPerformanceLog.js";
import GeoLog from "../models/GeoLog.js";
import CommunityHealthWorkerProfile from "../models/CommunityHealthWorkerProfile.js";
import Notification from "../models/Notification.js";
import CommunicationChannel from "../models/CommunicationChannel.js";

function role(req) {
  return String(req.user?.actualRole || req.user?.role || "").toUpperCase();
}

function isPrivileged(req) {
  return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"].includes(role(req));
}

function hospitalScope(req) {
  if (isPrivileged(req) && req.query?.hospitalId) return req.query.hospitalId;
  return req.user?.hospitalId || req.user?.hospital;
}

function chwScope(req) {
  if (role(req) === "COMMUNITY_HEALTH_WORKER") return req.user?._id;
  if (req.query?.chwId) return req.query.chwId;
  if (req.body?.chwId) return req.body.chwId;
  return req.user?._id;
}

async function notifyOpsForCHW(req, title, body, meta = {}) {
  const hospital = hospitalScope(req);
  if (!hospital) return;
  const channel = await CommunicationChannel.findOne({ hospital, key: "chw_hospital_operations", active: true }).lean();
  if (!channel) return;
  await Notification.create({
    hospital,
    title,
    body,
    category: "WORKFORCE",
    meta: { ...meta, channelId: channel._id, source: "CHW" },
  });
}

export const getChwDashboard = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      householdsAssigned,
      visitsToday,
      vaccinationsDue,
      highRiskPatients,
      referralsPending,
      diseaseAlerts,
      profile,
    ] = await Promise.all([
      Household.countDocuments({ hospital, chw, active: true }),
      FieldVisit.countDocuments({ hospital, chw, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      VaccinationRecord.countDocuments({ hospital, chw, administeredAt: { $gte: todayStart, $lte: todayEnd } }),
      MaternalRecord.countDocuments({ hospital, chw, highRiskPregnancy: true }),
      ChwReferral.countDocuments({ hospital, chw, status: "PENDING" }),
      DiseaseReport.countDocuments({ hospital, chw, severity: { $in: ["HIGH", "CRITICAL"] }, createdAt: { $gte: todayStart } }),
      CommunityHealthWorkerProfile.findOne({ hospital, user: chw }).lean(),
    ]);

    return res.json({
      householdsAssigned,
      visitsToday,
      vaccinationsDue,
      highRiskPatients,
      referralsPending,
      diseaseAlerts,
      profile: profile || null,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load CHW dashboard" });
  }
};

export const listHouseholds = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const q = String(req.query.q || "").trim();
    const filter = { hospital, chw, active: true };
    if (q) {
      filter.$or = [
        { householdId: { $regex: q, $options: "i" } },
        { headOfHousehold: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }
    const items = await Household.find(filter).sort({ nextVisitDate: 1, createdAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load households" });
  }
};

export const createHousehold = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const payload = {
      hospital,
      chw,
      householdId: String(req.body?.householdId || "").trim(),
      headOfHousehold: String(req.body?.headOfHousehold || "").trim(),
      phone: String(req.body?.phone || "").trim(),
      address: String(req.body?.address || "").trim(),
      ward: String(req.body?.ward || "").trim(),
      memberCount: Number(req.body?.memberCount || 0),
      riskLevel: String(req.body?.riskLevel || "LOW").toUpperCase(),
      nextVisitDate: req.body?.nextVisitDate ? new Date(req.body.nextVisitDate) : null,
    };
    if (!payload.householdId || !payload.headOfHousehold) {
      return res.status(400).json({ message: "householdId and headOfHousehold are required" });
    }
    const item = await Household.create(payload);
    await notifyOpsForCHW(req, "New CHW Household Added", `${payload.headOfHousehold} was registered in CHW catchment area.`, { householdId: item._id });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to create household" });
  }
};

export const addHouseholdMember = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const household = await Household.findOne({ _id: req.params.id, hospital }).lean();
    if (!household) return res.status(404).json({ message: "Household not found" });
    const item = await HouseholdMember.create({
      hospital,
      household: household._id,
      fullName: String(req.body?.fullName || "").trim(),
      relationship: String(req.body?.relationship || "").trim(),
      gender: String(req.body?.gender || "").trim(),
      dateOfBirth: req.body?.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
      nationalIdNumber: String(req.body?.nationalIdNumber || "").trim(),
      phone: String(req.body?.phone || "").trim(),
      chronicConditions: Array.isArray(req.body?.chronicConditions) ? req.body.chronicConditions : [],
      isPregnant: Boolean(req.body?.isPregnant),
      immunizationStatus: String(req.body?.immunizationStatus || "UNKNOWN"),
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add household member" });
  }
};

export const recordFieldVisit = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const household = await Household.findOne({ _id: req.params.id, hospital, chw }).lean();
    if (!household) return res.status(404).json({ message: "Household not found" });

    const visit = await FieldVisit.create({
      hospital,
      chw,
      household: household._id,
      category: String(req.body?.category || "GENERAL").toUpperCase(),
      status: String(req.body?.status || "COMPLETED").toUpperCase(),
      notes: String(req.body?.notes || "").trim(),
      nextActionDate: req.body?.nextActionDate ? new Date(req.body.nextActionDate) : null,
      vitals: req.body?.vitals || {},
      gps: req.body?.gps || {},
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
    });

    await Household.findByIdAndUpdate(household._id, {
      $set: {
        lastVisitDate: new Date(),
        nextVisitDate: visit.nextActionDate || household.nextVisitDate,
      },
    });

    await notifyOpsForCHW(req, "CHW Field Visit Submitted", `A field visit was completed for household ${household.householdId}.`, {
      householdId: household._id,
      visitId: visit._id,
      category: visit.category,
    });
    return res.status(201).json(visit);
  } catch (err) {
    return res.status(500).json({ message: "Failed to record field visit" });
  }
};

export const listFieldVisits = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const filter = { hospital, chw };
    if (req.query?.category) filter.category = String(req.query.category).toUpperCase();
    const items = await FieldVisit.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500))
      .populate("household", "householdId headOfHousehold")
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load field visits" });
  }
};

export const createMaternalRecord = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await MaternalRecord.create({
      hospital,
      chw,
      household: req.body?.household || null,
      motherName: String(req.body?.motherName || "").trim(),
      trimester: Number(req.body?.trimester || 1),
      ancVisits: Number(req.body?.ancVisits || 0),
      expectedDeliveryDate: req.body?.expectedDeliveryDate ? new Date(req.body.expectedDeliveryDate) : null,
      highRiskPregnancy: Boolean(req.body?.highRiskPregnancy),
      postnatalVisits: Number(req.body?.postnatalVisits || 0),
      notes: String(req.body?.notes || "").trim(),
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create maternal record" });
  }
};

export const createChildGrowthRecord = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await ChildGrowthRecord.create({
      hospital,
      chw,
      household: req.body?.household || null,
      childName: String(req.body?.childName || "").trim(),
      ageMonths: Number(req.body?.ageMonths || 0),
      weightKg: Number(req.body?.weightKg || 0),
      heightCm: Number(req.body?.heightCm || 0),
      muacCm: Number(req.body?.muacCm || 0),
      nutritionRisk: String(req.body?.nutritionRisk || "LOW").toUpperCase(),
      notes: String(req.body?.notes || "").trim(),
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create child growth record" });
  }
};

export const createVaccinationRecord = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await VaccinationRecord.create({
      hospital,
      chw,
      household: req.body?.household || null,
      memberName: String(req.body?.memberName || "").trim(),
      vaccine: String(req.body?.vaccine || "").trim(),
      dose: String(req.body?.dose || "").trim(),
      batchNumber: String(req.body?.batchNumber || "").trim(),
      expiryDate: req.body?.expiryDate ? new Date(req.body.expiryDate) : null,
      administeredAt: req.body?.administeredAt ? new Date(req.body.administeredAt) : new Date(),
      adverseEvent: String(req.body?.adverseEvent || "").trim(),
      coldChainStatus: String(req.body?.coldChainStatus || "OK").trim(),
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create vaccination record" });
  }
};

export const createChronicLog = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await ChronicPatientLog.create({
      hospital,
      chw,
      household: req.body?.household || null,
      patientName: String(req.body?.patientName || "").trim(),
      condition: String(req.body?.condition || "").trim(),
      medicationCompliance: String(req.body?.medicationCompliance || "GOOD").toUpperCase(),
      followUpDate: req.body?.followUpDate ? new Date(req.body.followUpDate) : null,
      vitals: req.body?.vitals || {},
      escalationRequired: Boolean(req.body?.escalationRequired),
      notes: String(req.body?.notes || "").trim(),
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create chronic log" });
  }
};

export const createDiseaseReport = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await DiseaseReport.create({
      hospital,
      chw,
      disease: String(req.body?.disease || "").trim(),
      suspectedCases: Number(req.body?.suspectedCases || 1),
      severity: String(req.body?.severity || "MEDIUM").toUpperCase(),
      location: String(req.body?.location || "").trim(),
      ward: String(req.body?.ward || "").trim(),
      symptoms: Array.isArray(req.body?.symptoms) ? req.body.symptoms : [],
      notes: String(req.body?.notes || "").trim(),
      geo: req.body?.geo || {},
      reportedToPublicHealth: Boolean(req.body?.reportedToPublicHealth),
    });
    await notifyOpsForCHW(req, "CHW Disease Alert Submitted", `${item.disease} report submitted with ${item.suspectedCases} suspected case(s).`, {
      diseaseReportId: item._id,
      severity: item.severity,
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create disease report" });
  }
};

export const createReferral = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await ChwReferral.create({
      hospital,
      chw,
      patientName: String(req.body?.patientName || "").trim(),
      patientPhone: String(req.body?.patientPhone || "").trim(),
      summary: String(req.body?.summary || "").trim(),
      urgency: String(req.body?.urgency || "MEDIUM").toUpperCase(),
      receivingHospital: req.body?.receivingHospital || hospital,
      status: "PENDING",
    });
    await notifyOpsForCHW(req, "CHW Referral Submitted", `Referral created for ${item.patientName} (${item.urgency}).`, {
      referralId: item._id,
      urgency: item.urgency,
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create referral" });
  }
};

export const listReferrals = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const items = await ChwReferral.find({ hospital, chw })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500))
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load referrals" });
  }
};

export const getPerformance = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const logs = await ChwPerformanceLog.find({ hospital, chw })
      .sort({ periodDate: -1 })
      .limit(24)
      .lean();

    if (logs.length) return res.json({ items: logs });

    const [householdsAssigned, visitsCompleted, missedVisits, vaccinationsAdministered, referralsMade] =
      await Promise.all([
        Household.countDocuments({ hospital, chw, active: true }),
        FieldVisit.countDocuments({ hospital, chw, status: "COMPLETED" }),
        FieldVisit.countDocuments({ hospital, chw, status: "MISSED" }),
        VaccinationRecord.countDocuments({ hospital, chw }),
        ChwReferral.countDocuments({ hospital, chw }),
      ]);

    return res.json({
      items: [
        {
          periodDate: new Date(),
          householdsAssigned,
          visitsCompleted,
          missedVisits,
          vaccinationsAdministered,
          referralsMade,
          maternalFollowUps: await MaternalRecord.countDocuments({ hospital, chw }),
          diseaseReportingTimeliness: 0,
          gpsComplianceScore: 0,
          supervisorRating: 0,
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load performance" });
  }
};

export const createGeoLog = async (req, res) => {
  try {
    const hospital = hospitalScope(req);
    const chw = chwScope(req);
    const item = await GeoLog.create({
      hospital,
      chw,
      event: String(req.body?.event || "VISIT_LOG").trim(),
      lat: Number(req.body?.lat),
      lng: Number(req.body?.lng),
      accuracy: req.body?.accuracy != null ? Number(req.body.accuracy) : null,
      note: String(req.body?.note || "").trim(),
      capturedAt: req.body?.capturedAt ? new Date(req.body.capturedAt) : new Date(),
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to create geo log" });
  }
};

