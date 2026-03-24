import Appointment from "../models/Appointment.js";
import Bed from "../models/Bed.js";
import ClinicalDraft from "../models/ClinicalDraft.js";
import Connector from "../models/Connector.js";
import DoctorAvailability from "../models/DoctorAvailability.js";
import EmergencyState from "../models/EmergencyState.js";
import Encounter from "../models/Encounter.js";
import Hl7Mapping from "../models/Hl7Mapping.js";
import Hospital from "../models/Hospital.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import LabOrder from "../models/LabOrder.js";
import MachineDevice from "../models/MachineDevice.js";
import Prescription from "../models/Prescription.js";
import Staff from "../models/Staff.js";
import Transfer from "../models/Transfer.js";

const ORDER_RULES = [
  {
    key: "RESPIRATORY",
    test: /(cough|flu|resp|asthma|pneum|bronch)/i,
    recommendations: [
      { orderType: "LAB", title: "CBC + infection markers", confidence: 0.74 },
      { orderType: "MEDICATION", title: "Symptom-control medication review", confidence: 0.66 },
    ],
  },
  {
    key: "CARDIO",
    test: /(hypertension|bp|pressure|cardio|heart|chest pain)/i,
    recommendations: [
      { orderType: "LAB", title: "Renal panel + electrolytes", confidence: 0.71 },
      { orderType: "REFERRAL", title: "Cardiology follow-up review", confidence: 0.62 },
    ],
  },
  {
    key: "MATERNAL",
    test: /(antenatal|pregnan|maternal|obstetric)/i,
    recommendations: [
      { orderType: "LAB", title: "Routine antenatal lab bundle", confidence: 0.77 },
      { orderType: "REFERRAL", title: "Maternal risk follow-up", confidence: 0.68 },
    ],
  },
  {
    key: "PAEDIATRIC",
    test: /(paed|child|fever|growth|vaccin)/i,
    recommendations: [
      { orderType: "LAB", title: "Paediatric infection screen", confidence: 0.7 },
      { orderType: "FOLLOW_UP", title: "Family monitoring check-in", confidence: 0.64 },
    ],
  },
  {
    key: "SURGERY",
    test: /(surgery|post-op|fracture|wound|theatre)/i,
    recommendations: [
      { orderType: "LAB", title: "Pre-op / post-op safety labs", confidence: 0.73 },
      { orderType: "IMAGING", title: "Imaging confirmation workflow", confidence: 0.61 },
    ],
  },
];

function toCountMap(rows, keyField, valueField = "count") {
  return rows.map((row) => ({
    key: row?._id || row?.[keyField] || "Unknown",
    count: Number(row?.[valueField] || row?.count || 0),
  }));
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((Number(numerator || 0) / Number(denominator || 1)) * 100).toFixed(1));
}

function buildHospitalMatch(hospitalId) {
  return hospitalId ? { hospital: hospitalId } : {};
}

function buildHospitalMatchByField(field, hospitalId) {
  return hospitalId ? { [field]: hospitalId } : {};
}

function recommendationReason(rule, diagnosis, recentCount) {
  return `${recentCount} recent encounter(s) mention ${diagnosis || "this pattern"}, so ${rule.title.toLowerCase()} is worth reviewing.`;
}

export async function getClinicalOrderCopilotSnapshot({ hospitalId = null, clinicianId = null } = {}) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const encounterMatch = {
    ...buildHospitalMatch(hospitalId),
    ...(clinicianId ? { doctor: clinicianId } : {}),
    createdAt: { $gte: since },
  };

  const [
    recentEncounters,
    diagnosisCounts,
    labCounts,
    medicationRows,
    pendingAuthCount,
    openDraftCount,
    pendingLabCount,
    totalTransfers,
  ] = await Promise.all([
    Encounter.find(encounterMatch)
      .sort({ createdAt: -1 })
      .limit(18)
      .populate("patient", "firstName lastName")
      .populate("doctor", "name email")
      .populate("hospital", "name")
      .lean(),
    Encounter.aggregate([
      { $match: encounterMatch },
      { $project: { diagnosis: { $trim: { input: { $ifNull: ["$diagnosis", "Unknown diagnosis"] } } } } },
      { $group: { _id: "$diagnosis", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    LabOrder.aggregate([
      { $match: { ...buildHospitalMatch(hospitalId), createdAt: { $gte: since } } },
      { $group: { _id: "$testName", count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    Prescription.aggregate([
      { $match: { ...buildHospitalMatch(hospitalId), createdAt: { $gte: since } } },
      { $unwind: { path: "$medications", preserveNullAndEmptyArrays: false } },
      { $group: { _id: "$medications.name", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    (async () => {
      const rows = await InsuranceAuthorization.aggregate([
        {
          $lookup: {
            from: "encounters",
            localField: "encounter",
            foreignField: "_id",
            as: "encounterDoc",
          },
        },
        {
          $unwind: {
            path: "$encounterDoc",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            status: "PENDING",
            ...(hospitalId ? { "encounterDoc.hospital": hospitalId } : {}),
          },
        },
        { $count: "count" },
      ]);
      return Number(rows?.[0]?.count || 0);
    })(),
    ClinicalDraft.countDocuments({ ...buildHospitalMatch(hospitalId), createdAt: { $gte: since } }),
    LabOrder.countDocuments({ ...buildHospitalMatch(hospitalId), status: "Pending" }),
    Transfer.countDocuments({ ...buildHospitalMatchByField("fromHospital", hospitalId), createdAt: { $gte: since } }),
  ]);

  const diagnosisMap = diagnosisCounts.map((row) => ({ diagnosis: row._id, count: Number(row.count || 0) }));
  const suggestions = [];
  const seenTitles = new Set();

  diagnosisMap.forEach((row) => {
    ORDER_RULES.forEach((rule) => {
      if (!rule.test.test(String(row.diagnosis || ""))) return;
      rule.recommendations.forEach((recommendation) => {
        const title = recommendation.title;
        if (seenTitles.has(title)) return;
        seenTitles.add(title);
        suggestions.push({
          ...recommendation,
          diagnosis: row.diagnosis,
          recentCount: row.count,
          reason: recommendationReason(recommendation, row.diagnosis, row.count),
          actionPath:
            recommendation.orderType === "LAB"
              ? "/labtech/labs"
              : recommendation.orderType === "MEDICATION"
              ? "/doctor/prescriptions"
              : recommendation.orderType === "REFERRAL"
              ? "/doctor/referrals"
              : "/doctor/opd",
        });
      });
    });
  });

  if (pendingAuthCount > 0) {
    suggestions.push({
      orderType: "AUTHORIZATION",
      title: "Prior authorization package review",
      confidence: 0.7,
      diagnosis: "Coverage workflow",
      recentCount: pendingAuthCount,
      reason: `${pendingAuthCount} authorization request(s) are still pending. Review payer requirements before finalizing new order bundles.`,
      actionPath: "/hospital-admin/claims",
    });
  }

  return {
    scope: {
      hospitalId: hospitalId || null,
      clinicianId: clinicianId || null,
    },
    summary: {
      recentEncounters: recentEncounters.length,
      suggestionCount: suggestions.length,
      pendingAuthorizations: pendingAuthCount,
      pendingLabOrders: pendingLabCount,
      openDrafts: openDraftCount,
      transfersNeedingContext: totalTransfers,
    },
    diagnosisSignals: diagnosisMap,
    topLabOrders: labCounts.map((row) => ({
      testName: row._id,
      count: Number(row.count || 0),
      pending: Number(row.pending || 0),
    })),
    topMedications: medicationRows.map((row) => ({ name: row._id, count: Number(row.count || 0) })),
    recentEncounters: recentEncounters.map((row) => ({
      _id: row._id,
      patientName: `${row?.patient?.firstName || ""} ${row?.patient?.lastName || ""}`.trim() || "Patient",
      doctorName: row?.doctor?.name || row?.doctor?.email || "Clinician",
      hospitalName: row?.hospital?.name || "Hospital",
      diagnosis: row?.diagnosis || "No diagnosis recorded",
      consultationNotes: row?.consultationNotes || "",
      state: row?.state || "CREATED",
      createdAt: row?.createdAt || null,
    })),
    suggestions,
  };
}

export async function getDigitalHospitalTwinSnapshot({ hospitalId = null } = {}) {
  const [
    hospitals,
    beds,
    machineRows,
    emergencyRows,
    staffRows,
    availabilityRows,
    appointmentRows,
    transferRows,
  ] = await Promise.all([
    Hospital.find(hospitalId ? { _id: hospitalId } : {}).select("name code").lean(),
    Bed.find(buildHospitalMatch(hospitalId)).select("hospital ward occupied").lean(),
    MachineDevice.find(buildHospitalMatch(hospitalId)).select("hospital status department machineType lastHeartbeatAt").lean(),
    EmergencyState.find(hospitalId ? { hospital: hospitalId } : {}).select("hospital active reason activatedAt").lean(),
    Staff.find(hospitalId ? { hospital: hospitalId } : {}).select("hospital role").lean(),
    DoctorAvailability.find(buildHospitalMatch(hospitalId)).select("hospital isAvailable consultationAvailable modes").lean(),
    Appointment.find({ ...(hospitalId ? { hospitalId } : {}), createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
      .select("hospitalId status consultationMode scheduledAt")
      .lean(),
    Transfer.find({ ...(hospitalId ? { fromHospital: hospitalId } : {}), createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
      .select("fromHospital toHospital status urgency")
      .lean(),
  ]);

  const hospitalMap = new Map(hospitals.map((row) => [String(row._id), row]));
  const bedsTotal = beds.length;
  const occupiedBeds = beds.filter((row) => row.occupied).length;
  const machineSummary = machineRows.reduce(
    (acc, row) => {
      const key = String(row.status || "OFFLINE").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );
  const staffSummary = staffRows.reduce((acc, row) => {
    const key = String(row.role || "other").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const activeEmergencyCount = emergencyRows.filter((row) => row.active).length;
  const activeConsultSlots = availabilityRows.filter((row) => row.isAvailable && row.consultationAvailable).length;

  const wardState = Object.values(
    beds.reduce((acc, row) => {
      const key = `${row.hospital || "hospital"}:${row.ward || "Ward"}`;
      if (!acc[key]) {
        acc[key] = {
          hospitalId: row.hospital,
          hospitalName: hospitalMap.get(String(row.hospital))?.name || "Hospital",
          ward: row.ward || "Ward",
          totalBeds: 0,
          occupiedBeds: 0,
        };
      }
      acc[key].totalBeds += 1;
      if (row.occupied) acc[key].occupiedBeds += 1;
      return acc;
    }, {})
  )
    .map((row) => ({
      ...row,
      occupancyRate: pct(row.occupiedBeds, row.totalBeds),
    }))
    .sort((a, b) => b.occupancyRate - a.occupancyRate)
    .slice(0, 16);

  const hospitalComparison = hospitals.map((hospital) => {
    const id = String(hospital._id);
    const hospitalBeds = beds.filter((row) => String(row.hospital) === id);
    const hospitalMachines = machineRows.filter((row) => String(row.hospital) === id);
    const hospitalAppointments = appointmentRows.filter((row) => String(row.hospitalId) === id);
    const hospitalTransfers = transferRows.filter((row) => String(row.fromHospital) === id);
    return {
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      code: hospital.code || "",
      bedOccupancyRate: pct(
        hospitalBeds.filter((row) => row.occupied).length,
        hospitalBeds.length
      ),
      onlineDevices: hospitalMachines.filter((row) => row.status === "ONLINE").length,
      deviceErrors: hospitalMachines.filter((row) => row.status === "ERROR").length,
      appointments24h: hospitalAppointments.length,
      transferPressure: hospitalTransfers.length,
    };
  });

  return {
    scope: {
      hospitalId: hospitalId || null,
      hospitalName: hospitalId ? hospitalMap.get(String(hospitalId))?.name || "Hospital" : "Network",
    },
    summary: {
      hospitals: hospitals.length,
      totalBeds: bedsTotal,
      occupiedBeds,
      occupancyRate: pct(occupiedBeds, bedsTotal),
      onlineDevices: Number(machineSummary.ONLINE || 0),
      offlineDevices: Number(machineSummary.OFFLINE || 0),
      deviceErrors: Number(machineSummary.ERROR || 0),
      activeEmergencyCount,
      activeConsultSlots,
      appointments24h: appointmentRows.length,
      transferPressure: transferRows.length,
    },
    staffSummary,
    machineSummary,
    wardState,
    hospitalComparison,
    emergencyWatch: emergencyRows
      .filter((row) => row.active)
      .map((row) => ({
        hospitalId: row.hospital,
        hospitalName: hospitalMap.get(String(row.hospital))?.name || "Hospital",
        reason: row.reason || "Emergency state active",
        activatedAt: row.activatedAt || row.createdAt || null,
      })),
  };
}

export async function getInteropMarketplaceSnapshot({ hospitalId = null } = {}) {
  const [connectors, mappings, hospitals] = await Promise.all([
    Connector.find(hospitalId ? { hospitalId } : {}).sort({ createdAt: -1 }).lean(),
    Hl7Mapping.find({}).sort({ updatedAt: -1 }).lean(),
    Hospital.find(hospitalId ? { _id: hospitalId } : {}).select("name code").lean(),
  ]);

  const hospitalMap = new Map(hospitals.map((row) => [String(row._id), row]));
  const connectorSummary = connectors.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.isActive) acc.active += 1;
      if (row.capabilities?.supportsRealtime) acc.realtime += 1;
      if (row.capabilities?.supportsBatch) acc.batch += 1;
      const type = String(row.type || "custom").toLowerCase();
      acc.byType[type] = (acc.byType[type] || 0) + 1;
      return acc;
    },
    { total: 0, active: 0, realtime: 0, batch: 0, byType: {} }
  );

  const curatedApps = [
    { key: "fhir", label: "FHIR Clinical Exchange", category: "Clinical Data", profiles: ["FHIR_R4"], types: ["fhir"] },
    { key: "hl7", label: "HL7 Orders Bridge", category: "Orders & Results", profiles: ["HL7_V2"], types: ["hl7", "lis", "his"] },
    { key: "dicom", label: "DICOM Imaging Exchange", category: "Imaging", profiles: ["DICOM"], types: ["dicom"] },
    { key: "payments", label: "Payments & Collections", category: "Revenue Cycle", profiles: ["REST", "CUSTOM"], types: ["mpesa"] },
    { key: "outreach", label: "Patient Outreach Channels", category: "Engagement", profiles: ["REST", "CUSTOM"], types: ["sms", "email"] },
    { key: "custom", label: "Custom Hospital Connector", category: "Platform", profiles: ["CUSTOM", "CSV", "REST"], types: ["custom", "emr"] },
  ].map((app) => {
    const installed = connectors.filter((row) => app.types.includes(String(row.type || "").toLowerCase()));
    return {
      ...app,
      installedCount: installed.length,
      activeCount: installed.filter((row) => row.isActive).length,
      hospitals: [...new Set(installed.map((row) => hospitalMap.get(String(row.hospitalId))?.name).filter(Boolean))],
      readiness: installed.some((row) => row.runtime?.mode === "CUTOVER")
        ? "CUTOVER_READY"
        : installed.some((row) => row.isActive)
        ? "ACTIVE"
        : installed.length
        ? "CONFIGURED"
        : "NOT_INSTALLED",
    };
  });

  return {
    scope: {
      hospitalId: hospitalId || null,
      hospitalName: hospitalId ? hospitalMap.get(String(hospitalId))?.name || "Hospital" : "Network",
    },
    summary: {
      connectors: connectorSummary.total,
      activeConnectors: connectorSummary.active,
      realtimeReady: connectorSummary.realtime,
      batchReady: connectorSummary.batch,
      hl7Mappings: mappings.length,
    },
    connectorTypes: Object.entries(connectorSummary.byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    curatedApps,
    mappings: mappings.slice(0, 24).map((row) => ({
      _id: row._id,
      messageType: row.messageType,
      sourceSystem: row.sourceSystem,
      targetSystem: row.targetSystem,
      isActive: row.isActive !== false,
      updatedAt: row.updatedAt || row.createdAt || null,
    })),
    recentConnectors: connectors.slice(0, 20).map((row) => ({
      _id: row._id,
      name: row.name,
      type: row.type,
      profile: row.profile,
      mode: row.runtime?.mode || "SHADOW",
      isActive: row.isActive !== false,
      hospitalName: hospitalMap.get(String(row.hospitalId))?.name || "Global",
      lastSuccessAt: row.runtime?.lastSuccessAt || row.lastSync || null,
      lastError: row.runtime?.lastError || "",
    })),
  };
}
