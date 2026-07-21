import Hospital from "../models/Hospital.js";
import Branch from "../models/Branch.js";
import User from "../models/User.js";
import Connector from "../models/Connector.js";
import ConnectorSlaEvent from "../models/ConnectorSlaEvent.js";
import Transaction from "../models/Transaction.js";
import Invoice from "../models/Invoice.js";
import Financial from "../models/Financial.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import OfflineClientMetric from "../models/OfflineClientMetric.js";
import Transfer from "../models/Transfer.js";
import Appointment from "../models/Appointment.js";
import MachineDevice from "../models/MachineDevice.js";
import PharmacyItem from "../models/PharmacyItem.js";
import Bed from "../models/Bed.js";
import TrainingTracker from "../models/TrainingTracker.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import SreIncident from "../models/SreIncident.js";
import AbacPolicy from "../models/AbacPolicy.js";
import AbacPolicyTestCase from "../models/AbacPolicyTestCase.js";
import { evaluateAbac } from "../utils/abacEngine.js";
import { getRiskPolicy, upsertRiskPolicy } from "../utils/riskPolicy.js";
import { logAudit } from "../services/auditService.js";
import { getEtimsCredentials, getMpesaCredentials, getShaCredentials } from "../services/integrationCredentials.js";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";
import PatientIdentityRegistry from "../models/PatientIdentityRegistry.js";
import ClaimRule from "../models/ClaimRule.js";
import Notification from "../models/Notification.js";
import fs from "fs/promises";
import { getPaymentSettingsDoc } from "../utils/paymentSettingsStore.js";
import FREE_API_CATALOG from "../config/freeApiCatalog.js";

const INTEGRATION_HUB_MODULES = [
  {
    key: "SHA_HIE",
    label: "SHA HIE",
    description: "National eligibility, claims, and continuity exchange.",
    match: (connector) =>
      /sha|nhif|hie|social health/i.test(
        [
          connector?.name,
          connector?.url,
          connector?.config?.partner,
          connector?.config?.vendor,
          connector?.config?.description,
        ]
          .filter(Boolean)
          .join(" ")
      ),
  },
  {
    key: "KRA_ETIMS",
    label: "KRA eTIMS",
    description: "Tax-compliant invoicing and fiscal receipt evidence.",
    match: (connector) =>
      /kra|etims|tax/i.test(
        [
          connector?.name,
          connector?.url,
          connector?.config?.partner,
          connector?.config?.vendor,
          connector?.config?.description,
        ]
          .filter(Boolean)
          .join(" ")
      ),
  },
  {
    key: "MPESA",
    label: "M-PESA",
    description: "Collections, reconciliation, and mobile-money settlement.",
    match: (connector) => /mpesa/i.test(JSON.stringify(connector || {})),
  },
  {
    key: "FHIR",
    label: "FHIR Gateway",
    description: "Standards-based care exchange and migration APIs.",
    match: (connector) =>
      String(connector?.profile || "").toUpperCase().includes("FHIR") ||
      String(connector?.type || "").toLowerCase() === "fhir",
  },
  {
    key: "HL7",
    label: "HL7 Gateway",
    description: "Legacy ADT, LIS, and machine message flow.",
    match: (connector) =>
      String(connector?.profile || "").toUpperCase().includes("HL7") ||
      String(connector?.type || "").toLowerCase() === "hl7",
  },
  {
    key: "DICOM",
    label: "DICOM Imaging",
    description: "Radiology/PACS study routing and imaging continuity.",
    match: (connector) =>
      String(connector?.profile || "").toUpperCase().includes("DICOM") ||
      String(connector?.type || "").toLowerCase() === "dicom",
  },
  {
    key: "INSURANCE",
    label: "Insurance APIs",
    description: "Eligibility, claims, pre-auth, and denial recovery.",
    match: (connector) =>
      /insurance|claim|payer|preauth/i.test(
        [
          connector?.name,
          connector?.url,
          connector?.config?.partner,
          connector?.config?.vendor,
          connector?.config?.description,
        ]
          .filter(Boolean)
          .join(" ")
      ),
  },
];

function deriveIntegrationStatus(connectors = []) {
  if (!connectors.length) return "MISSING";
  const active = connectors.filter((row) => row.isActive !== false);
  if (!active.length) return "DISABLED";
  const healthy = active.filter((row) => {
    const lastSuccessAt = row.runtime?.lastSuccessAt || row.lastSync || null;
    const lastErrorAt = row.runtime?.lastErrorAt || null;
    if (!lastSuccessAt) return false;
    if (!lastErrorAt) return true;
    return new Date(lastSuccessAt) >= new Date(lastErrorAt);
  });
  if (healthy.length === active.length) return "READY";
  if (healthy.length > 0) return "AT_RISK";
  return "DEGRADED";
}

function startOfLast30Days() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function regionKeyForHospital(hospital) {
  const country = String(hospital?.location?.country || "").trim();
  const region = String(hospital?.location?.region || "").trim();
  const city = String(hospital?.location?.city || "").trim();
  return region || city || country || "Unassigned";
}

function buildControlPlaneActionPanel(key, context = {}) {
  const missingText = Array.isArray(context?.credentials?.missing) && context.credentials.missing.length
    ? `Missing: ${context.credentials.missing.join(", ")}`
    : "Credentials loaded.";

  if (key === "SHA") {
    return [
      {
        label: "Credentials",
        state: context.credentials?.configured ? "ready" : "missing",
        note: context.credentials?.configured
          ? "SHA credentials are loaded in the backend."
          : missingText,
      },
      {
        label: "Connector runtime",
        state: context.connectors > 0 ? "ready" : "missing",
        note: context.connectors > 0 ? "SHA connector is provisioned." : "Create and baseline the SHA connector.",
      },
      {
        label: "Hospital rollout",
        state: context.hospitalCoverage > 0 ? "ready" : "watch",
        note:
          context.hospitalCoverage > 0
            ? `${context.hospitalCoverage} hospitals have SHA enabled.`
            : "No hospital has SHA enabled in commerce config.",
      },
      {
        label: "Pre-auth approval flow",
        state: (context.approvedPreauth || 0) > 0 ? "ready" : "watch",
        note:
          (context.approvedPreauth || 0) > 0
            ? `${context.approvedPreauth}/${context.preauthRequests || 0} pre-auth requests approved.`
            : "No approved SHA pre-auth requests yet.",
      },
    ];
  }

  if (key === "ETIMS") {
    return [
      {
        label: "Credentials",
        state: context.credentials?.configured ? "ready" : "missing",
        note: context.credentials?.configured
          ? "eTIMS credentials are loaded in the backend."
          : missingText,
      },
      {
        label: "Connector runtime",
        state: context.connectors > 0 ? "ready" : "missing",
        note: context.connectors > 0 ? "eTIMS connector is available." : "Provision the eTIMS connector.",
      },
      {
        label: "Invoice export trail",
        state: (context.overdueInvoices || 0) > 0 ? "watch" : "ready",
        note:
          (context.overdueInvoices || 0) > 0
            ? `${context.overdueInvoices} overdue unpaid invoices need fiscal review.`
            : "No overdue invoice pressure blocking rollout.",
      },
      {
        label: "Hospital rollout",
        state: context.hospitalCoverage > 0 ? "ready" : "watch",
        note:
          context.hospitalCoverage > 0
            ? `${context.hospitalCoverage} hospitals are payment-enabled for fiscal sync.`
            : "Enable payments for at least one hospital before cutover.",
      },
    ];
  }

  if (key === "MPESA") {
    return [
      {
        label: "Runtime credentials",
        state: context.credentials?.configured ? "ready" : "missing",
        note: context.credentials?.configured
          ? "M-PESA env credentials are loaded for runtime."
          : missingText,
      },
      {
        label: "Global secrets",
        state: context.configured ? "ready" : "missing",
        note: context.configured ? "Consumer key, secret, and shortcode are set." : "Complete global M-PESA secret setup.",
      },
      {
        label: "Connector runtime",
        state: context.connectors > 0 ? "ready" : "watch",
        note: context.connectors > 0 ? "M-PESA connector is live." : "Provision and probe the M-PESA rail.",
      },
      {
        label: "Collection quality",
        state: (context.failedCollections30d || 0) > 0 ? "watch" : "ready",
        note:
          (context.failedCollections30d || 0) > 0
            ? `${context.failedCollections30d} failed collections in the last 30 days.`
            : "No failed collections in the last 30 days.",
      },
    ];
  }

  return [];
}

export const getSystemAdminMetrics = async (_req, res) => {
  try {
    const [hospitals, staff, leave, overtime, shifts] = await Promise.all([
      Hospital.countDocuments({ active: { $ne: false } }),
      User.countDocuments({
        role: { $nin: ["PATIENT", "GUEST"] },
        active: { $ne: false },
      }),
      LeaveRequest.countDocuments({ status: "PENDING" }),
      OvertimeRequest.countDocuments({ status: "PENDING" }),
      ShiftRequest.countDocuments({ status: "PENDING" }),
    ]);

    res.json({
      hospitals,
      staff,
      approvals: {
        leave,
        overtime,
        shifts,
        total: leave + overtime + shifts,
      },
    });
  } catch (err) {
    console.error("System admin metrics error:", err);
    res.status(500).json({ message: "Failed to load system metrics" });
  }
};

export const getIntegrationHubSummary = async (_req, res) => {
  try {
    const [connectors, recentEvents] = await Promise.all([
      Connector.find({})
        .select("name type profile runtime lastSync isActive hospitalId url")
        .sort({ createdAt: -1, _id: -1 })
        .lean(),
      ConnectorSlaEvent.find({})
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
    ]);

    const connectorIds = new Set(connectors.map((row) => String(row._id)));
    const latestEventByConnector = new Map();
    for (const event of recentEvents) {
      const connectorId = String(event.connectorId || "");
      if (!connectorIds.has(connectorId) || latestEventByConnector.has(connectorId)) continue;
      latestEventByConnector.set(connectorId, event);
    }

    const modules = INTEGRATION_HUB_MODULES.map((module) => {
      const rows = connectors.filter((connector) => module.match(connector));
      const activeRows = rows.filter((row) => row.isActive !== false);
      const latestSuccessAt = activeRows
        .map((row) => row.runtime?.lastSuccessAt || row.lastSync || null)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;
      const latestErrorAt = activeRows
        .map((row) => row.runtime?.lastErrorAt || null)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;

      const latestProbe = activeRows
        .map((row) => latestEventByConnector.get(String(row._id)))
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

      const status = deriveIntegrationStatus(activeRows);
      const runtimeModes = [...new Set(activeRows.map((row) => row.runtime?.mode).filter(Boolean))];
      const profiles = [...new Set(activeRows.map((row) => row.profile).filter(Boolean))];

      return {
        key: module.key,
        label: module.label,
        description: module.description,
        status,
        connectorCount: rows.length,
        activeConnectorCount: activeRows.length,
        healthyConnectorCount: activeRows.filter((row) => deriveIntegrationStatus([row]) === "READY").length,
        runtimeModes,
        profiles,
        latestSuccessAt,
        latestErrorAt,
        latestProbe: latestProbe
          ? {
              ok: Boolean(latestProbe.ok),
              operation: latestProbe.operation,
              createdAt: latestProbe.createdAt,
              latencyMs: latestProbe.latencyMs || null,
              breach: Boolean(latestProbe.breach),
            }
          : null,
        nextAction:
          status === "MISSING"
            ? "Create connector and baseline runtime."
            : status === "DISABLED"
              ? "Re-enable connector and run probe."
              : status === "DEGRADED"
                ? "Repair failing connector and inspect SLA events."
                : status === "AT_RISK"
                  ? "Stabilize active errors before cutover."
                  : "Advance migration mode or onboard more hospitals.",
      };
    });

    const totals = {
      totalConnectors: connectors.length,
      readyModules: modules.filter((row) => row.status === "READY").length,
      atRiskModules: modules.filter((row) => row.status === "AT_RISK").length,
      degradedModules: modules.filter((row) => row.status === "DEGRADED").length,
      missingModules: modules.filter((row) => row.status === "MISSING").length,
    };

    return res.json({ totals, modules, connectors, freeApis: FREE_API_CATALOG });
  } catch (err) {
    console.error("Integration hub summary error:", err);
    return res.status(500).json({ message: "Failed to load integration hub summary" });
  }
};

export const getPaymentsControlPlaneSummary = async (_req, res) => {
  try {
    const since = startOfLast30Days();
    const [shaCredentials, etimsCredentials, mpesaCredentials, paymentSettings, hospitals, connectors, transactions, overdueInvoices, claimRows] = await Promise.all([
      getShaCredentials(),
      getEtimsCredentials(),
      getMpesaCredentials(),
      getPaymentSettingsDoc({ lean: true, createIfMissing: false }),
      Hospital.find({})
        .select("name features insuranceProviders patientPaymentMethods active")
        .lean(),
      Connector.find({})
        .select("name type profile runtime isActive url config")
        .lean(),
      Transaction.find({ createdAt: { $gte: since } })
        .select("provider status amount currency createdAt hospital")
        .lean(),
      Invoice.countDocuments({
        status: "Unpaid",
        createdAt: { $lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      }),
      Financial.find({ "insuranceClaim.claimId": { $exists: true, $ne: "" } })
        .select("hospital insuranceClaim createdAt total")
        .lean(),
    ]);

    const paymentEnabledHospitals = hospitals.filter((row) => row?.features?.payments);
    const shaCoverageHospitals = hospitals.filter((row) =>
      Array.isArray(row?.insuranceProviders) &&
      row.insuranceProviders.some((provider) => /sha|nhif/i.test(`${provider?.code || ""} ${provider?.name || ""}`) && provider?.enabled !== false)
    );
    const mpesaCoverageHospitals = hospitals.filter((row) =>
      Array.isArray(row?.patientPaymentMethods) &&
      row.patientPaymentMethods.some((method) => /mpesa/i.test(method?.type || "") && method?.enabled !== false)
    );

    const shaConnectors = connectors.filter((row) => INTEGRATION_HUB_MODULES.find((m) => m.key === "SHA_HIE")?.match(row));
    const etimsConnectors = connectors.filter((row) => INTEGRATION_HUB_MODULES.find((m) => m.key === "KRA_ETIMS")?.match(row));
    const mpesaConnectors = connectors.filter((row) => INTEGRATION_HUB_MODULES.find((m) => m.key === "MPESA")?.match(row));

    const providerSummary = ["mpesa", "stripe", "flutterwave"].map((provider) => {
      const rows = transactions.filter((row) => String(row.provider || "").toLowerCase() === provider);
      const successful = rows.filter((row) => String(row.status || "").toLowerCase() === "succeeded" || String(row.status || "").toLowerCase() === "success");
      const pending = rows.filter((row) => String(row.status || "").toLowerCase() === "pending");
      const failed = rows.length - successful.length - pending.length;
      const totalAmount = successful.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return {
        provider: provider.toUpperCase(),
        totalTransactions: rows.length,
        successful: successful.length,
        pending: pending.length,
        failed,
        totalAmount,
      };
    });

    const shaPreauthRequests = await InsuranceAuthorization.countDocuments({ provider: "SHA" });
    const shaApprovedPreauth = await InsuranceAuthorization.countDocuments({ provider: "SHA", status: "APPROVED" });

    const controlPlanes = [
      {
        key: "SHA",
        label: "SHA Claims Control",
        readiness:
          shaCredentials.configured
            ? (shaConnectors.length && shaCoverageHospitals.length
                ? deriveIntegrationStatus(shaConnectors)
                : shaCoverageHospitals.length
                  ? "AT_RISK"
                  : "MISSING")
            : "MISSING",
        connectors: shaConnectors.length,
        hospitalCoverage: shaCoverageHospitals.length,
        preauthRequests: shaPreauthRequests,
        approvedPreauth: shaApprovedPreauth,
        deniedClaims: claimRows.filter((row) => String(row?.insuranceClaim?.status || "").toUpperCase() === "REJECTED").length,
        nextAction:
          shaConnectors.length
            ? "Expand SHA-linked hospitals and reduce rejected claims."
            : "Provision SHA connector and enable SHA on hospital commerce config.",
        actionPanel: buildControlPlaneActionPanel("SHA", {
          credentials: shaCredentials,
          connectors: shaConnectors.length,
          hospitalCoverage: shaCoverageHospitals.length,
          preauthRequests: shaPreauthRequests,
          approvedPreauth: shaApprovedPreauth,
        }),
      },
      {
        key: "ETIMS",
        label: "KRA eTIMS Control",
        readiness: etimsCredentials.configured
          ? (etimsConnectors.length ? deriveIntegrationStatus(etimsConnectors) : "MISSING")
          : "MISSING",
        connectors: etimsConnectors.length,
        hospitalCoverage: paymentEnabledHospitals.length,
        preauthRequests: 0,
        approvedPreauth: 0,
        deniedClaims: 0,
        nextAction: etimsConnectors.length
          ? "Validate fiscal receipt flow and reconcile billing exports."
          : "Provision eTIMS connector and bind invoice export trail.",
        actionPanel: buildControlPlaneActionPanel("ETIMS", {
          credentials: etimsCredentials,
          connectors: etimsConnectors.length,
          hospitalCoverage: paymentEnabledHospitals.length,
          overdueInvoices,
        }),
      },
      {
        key: "MPESA",
        label: "M-PESA Collections",
        readiness:
          mpesaCredentials.configured
            ? (paymentSettings?.mpesa?.consumerKey && paymentSettings?.mpesa?._enc && paymentSettings?.mpesa?.shortcode
                ? (mpesaConnectors.length ? deriveIntegrationStatus(mpesaConnectors) : "AT_RISK")
                : "MISSING")
            : "MISSING",
        connectors: mpesaConnectors.length,
        hospitalCoverage: mpesaCoverageHospitals.length,
        transactions30d: providerSummary.find((row) => row.provider === "MPESA")?.totalTransactions || 0,
        successfulCollections30d: providerSummary.find((row) => row.provider === "MPESA")?.successful || 0,
        failedCollections30d: providerSummary.find((row) => row.provider === "MPESA")?.failed || 0,
        nextAction:
          paymentSettings?.mpesa?.consumerKey && paymentSettings?.mpesa?._enc
            ? "Drive hospital rollout and watch failed collection spikes."
            : "Complete global M-PESA secrets and shortcode setup.",
        actionPanel: buildControlPlaneActionPanel("MPESA", {
          credentials: mpesaCredentials,
          configured: Boolean(paymentSettings?.mpesa?.consumerKey && paymentSettings?.mpesa?._enc && paymentSettings?.mpesa?.shortcode),
          connectors: mpesaConnectors.length,
          failedCollections30d: providerSummary.find((row) => row.provider === "MPESA")?.failed || 0,
        }),
      },
    ];

    return res.json({
      summary: {
        paymentEnabledHospitals: paymentEnabledHospitals.length,
        shaCoverageHospitals: shaCoverageHospitals.length,
        mpesaCoverageHospitals: mpesaCoverageHospitals.length,
        overdueInvoices,
        totalTransactions30d: transactions.length,
        succeededTransactions30d: providerSummary.reduce((sum, row) => sum + row.successful, 0),
      },
      providers: providerSummary,
      controlPlanes,
      paymentConfig: {
        mode: paymentSettings?.mode || "FREE",
        stripeConfigured: Boolean(paymentSettings?.stripe?.publishable && paymentSettings?.stripe?._enc),
        mpesaConfigured: Boolean(paymentSettings?.mpesa?.consumerKey && paymentSettings?.mpesa?._enc && paymentSettings?.mpesa?.shortcode),
        flutterwaveConfigured: Boolean(paymentSettings?.flutterwave?._enc),
        shaConfigured: shaCredentials.configured,
        etimsConfigured: etimsCredentials.configured,
        mpesaRuntimeConfigured: mpesaCredentials.configured,
      },
    });
  } catch (err) {
    console.error("Payments control plane summary error:", err);
    return res.status(500).json({ message: "Failed to load payments control plane" });
  }
};

export const getCountyCommandCenterSummary = async (req, res) => {
  try {
    const regionFilter = String(req.query?.region || "").trim();
    const hospitals = await Hospital.find({ active: { $ne: false } })
      .select("name code active location")
      .lean();

    const scopedHospitals = regionFilter
      ? hospitals.filter((row) => regionKeyForHospital(row) === regionFilter)
      : hospitals;
    const hospitalIds = scopedHospitals.map((row) => row._id);

    const [
      users,
      transfers,
      offlineMetrics,
      machineDevices,
      trackers,
      stockItems,
      sreIncidents,
      beds,
      leavePending,
      overtimePending,
      shiftPending,
      appointmentsToday,
    ] = await Promise.all([
      User.find({ hospital: { $in: hospitalIds }, active: { $ne: false } })
        .select("hospital role active")
        .lean(),
      Transfer.find({
        $or: [{ fromHospital: { $in: hospitalIds } }, { toHospital: { $in: hospitalIds } }],
      })
        .select("fromHospital toHospital status metadata createdAt")
        .lean(),
      OfflineClientMetric.find({ hospital: { $in: hospitalIds } })
        .select("hospital queueLength failedTotal online clientUpdatedAt")
        .lean(),
      MachineDevice.find({ hospital: { $in: hospitalIds }, active: true })
        .select("hospital status")
        .lean(),
      TrainingTracker.find({ hospital: { $in: hospitalIds } })
        .select("hospital status progressPercent")
        .lean(),
      PharmacyItem.find({ hospital: { $in: hospitalIds } })
        .select("hospital totalQuantity minStock")
        .lean(),
      SreIncident.find({
        hospital: { $in: hospitalIds },
        status: { $in: ["OPEN", "ACKED", "MITIGATED"] },
      })
        .select("hospital severity status")
        .lean(),
      Bed.find({ hospital: { $in: hospitalIds } }).select("hospital occupied").lean(),
      LeaveRequest.countDocuments({ hospital: { $in: hospitalIds }, status: "PENDING" }),
      OvertimeRequest.countDocuments({ hospital: { $in: hospitalIds }, status: "PENDING" }),
      ShiftRequest.countDocuments({ hospital: { $in: hospitalIds }, status: "PENDING" }),
      Appointment.find({
        hospital: { $in: hospitalIds },
        scheduledAt: { $gte: startOfToday() },
        status: { $nin: ["Cancelled", "Completed"] },
      })
        .select("hospital")
        .lean(),
    ]);

    const rowsByRegion = new Map();
    for (const hospital of scopedHospitals) {
      const key = regionKeyForHospital(hospital);
      if (!rowsByRegion.has(key)) {
        rowsByRegion.set(key, {
          region: key,
          hospitals: 0,
          staff: 0,
          doctors: 0,
          nurses: 0,
          pendingTransfers: 0,
          overdueTransfers: 0,
          offlineQueue: 0,
          offlineFailures: 0,
          offlineClients: 0,
          offlineClientsOffline: 0,
          machineOffline: 0,
          machineError: 0,
          totalBeds: 0,
          occupiedBeds: 0,
          lowStockItems: 0,
          criticalStockItems: 0,
          openOutages: 0,
          criticalOutages: 0,
          trainingCompletionRate: 0,
          appointmentPressure: 0,
        });
      }
      rowsByRegion.get(key).hospitals += 1;
    }

    const hospitalToRegion = new Map(scopedHospitals.map((row) => [String(row._id), regionKeyForHospital(row)]));

    for (const user of users) {
      const region = hospitalToRegion.get(String(user.hospital));
      if (!region) continue;
      const bucket = rowsByRegion.get(region);
      bucket.staff += 1;
      if (String(user.role || "").toUpperCase() === "DOCTOR") bucket.doctors += 1;
      if (String(user.role || "").toUpperCase() === "NURSE") bucket.nurses += 1;
    }

    for (const transfer of transfers) {
      const score = Number(transfer?.metadata?.handoverCompletionScore ?? 100);
      const relatedRegions = [
        hospitalToRegion.get(String(transfer.fromHospital)),
        hospitalToRegion.get(String(transfer.toHospital)),
      ].filter(Boolean);
      const uniqueRegions = [...new Set(relatedRegions)];
      for (const region of uniqueRegions) {
        const bucket = rowsByRegion.get(region);
        if (!bucket) continue;
        if (transfer.status !== "Completed" && transfer.status !== "Rejected") {
          bucket.pendingTransfers += 1;
        }
        if (transfer.status !== "Completed" && transfer.status !== "Rejected" && score < 100) {
          bucket.overdueTransfers += 1;
        }
      }
    }

    for (const metric of offlineMetrics) {
      const region = hospitalToRegion.get(String(metric.hospital));
      if (!region) continue;
      const bucket = rowsByRegion.get(region);
      bucket.offlineQueue += Number(metric.queueLength || 0);
      bucket.offlineFailures += Number(metric.failedTotal || 0);
      bucket.offlineClients += 1;
      if (metric.online === false) bucket.offlineClientsOffline += 1;
    }

    for (const device of machineDevices) {
      const region = hospitalToRegion.get(String(device.hospital));
      if (!region) continue;
      const bucket = rowsByRegion.get(region);
      if (device.status === "OFFLINE") bucket.machineOffline += 1;
      if (device.status === "ERROR") bucket.machineError += 1;
    }

    for (const bed of beds) {
      const region = hospitalToRegion.get(String(bed.hospital));
      if (!region) continue;
      const bucket = rowsByRegion.get(region);
      bucket.totalBeds += 1;
      if (bed.occupied) bucket.occupiedBeds += 1;
    }

    for (const item of stockItems) {
      const region = hospitalToRegion.get(String(item.hospital));
      if (!region) continue;
      const bucket = rowsByRegion.get(region);
      const totalQuantity = Number(item.totalQuantity || 0);
      const minStock = Number(item.minStock || 0);
      if (totalQuantity <= minStock) bucket.lowStockItems += 1;
      if (totalQuantity <= Math.max(0, Math.floor(minStock / 2))) bucket.criticalStockItems += 1;
    }

    for (const incident of sreIncidents) {
      const region = hospitalToRegion.get(String(incident.hospital));
      if (!region) continue;
      const bucket = rowsByRegion.get(region);
      bucket.openOutages += 1;
      if (String(incident.severity || "").toUpperCase() === "SEV1") bucket.criticalOutages += 1;
    }

    for (const appointment of appointmentsToday) {
      const region = hospitalToRegion.get(String(appointment.hospital));
      if (!region) continue;
      rowsByRegion.get(region).appointmentPressure += 1;
    }

    const trainingByRegion = new Map();
    for (const tracker of trackers) {
      const region = hospitalToRegion.get(String(tracker.hospital));
      if (!region) continue;
      const current = trainingByRegion.get(region) || { total: 0, sum: 0 };
      current.total += 1;
      current.sum += Number(tracker.progressPercent || 0);
      trainingByRegion.set(region, current);
    }

    const regions = Array.from(rowsByRegion.values()).map((row) => {
      const training = trainingByRegion.get(row.region);
      return {
        ...row,
        trainingCompletionRate: training?.total ? Math.round(training.sum / training.total) : 0,
        bedOccupancyRate: row.totalBeds ? Math.round((row.occupiedBeds / row.totalBeds) * 100) : 0,
      };
    });
    const allRegions = [...new Set(hospitals.map((row) => regionKeyForHospital(row)).filter(Boolean))].sort();
    const bedsTotal = beds.length;
    const bedsOccupied = beds.filter((row) => row.occupied).length;
    const lowStockItems = stockItems.filter((item) => Number(item.totalQuantity || 0) <= Number(item.minStock || 0)).length;
    const criticalStockItems = stockItems.filter(
      (item) => Number(item.totalQuantity || 0) <= Math.max(0, Math.floor(Number(item.minStock || 0) / 2))
    ).length;
    const openOutages = sreIncidents.length;
    const sev1Outages = sreIncidents.filter((row) => String(row.severity || "").toUpperCase() === "SEV1").length;

    const totalHospitals = regions.reduce((sum, row) => sum + row.hospitals, 0);

    return res.json({
      summary: {
        totalRegions: regions.length,
        totalHospitals,
        pendingApprovals: leavePending + overtimePending + shiftPending,
        appointmentsToday: appointmentsToday.length,
        regionsAtRisk: regions.filter(
          (row) => row.offlineFailures > 0 || row.machineError > 0 || row.pendingTransfers > 5 || row.openOutages > 0
        ).length,
        bedState: {
          total: bedsTotal,
          occupied: bedsOccupied,
          available: Math.max(0, bedsTotal - bedsOccupied),
          occupancyRate: bedsTotal ? Math.round((bedsOccupied / bedsTotal) * 100) : 0,
        },
        stockRisk: {
          lowStockItems,
          criticalStockItems,
        },
        outages: {
          open: openOutages,
          sev1: sev1Outages,
        },
      },
      allRegions,
      regions: regions.sort((a, b) => b.pendingTransfers + b.offlineQueue - (a.pendingTransfers + a.offlineQueue)),
    });
  } catch (err) {
    console.error("County command center summary error:", err);
    return res.status(500).json({ message: "Failed to load county command center" });
  }
};

export const listGovernmentHospitalRegistry = async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };
    const items = await GovernmentHospitalRegistry.find(filter)
      .sort(q ? { score: { $meta: "textScore" }, officialName: 1 } : { createdAt: -1 })
      .limit(500)
      .lean();
    return res.json({ items });
  } catch (err) {
    console.error("Government registry list error:", err);
    return res.status(500).json({ message: "Failed to load government registry" });
  }
};

export const createGovernmentHospitalRegistryEntry = async (req, res) => {
  try {
    const payload = {
      officialName: String(req.body?.officialName || "").trim(),
      registrationNumber: String(req.body?.registrationNumber || "").trim().toUpperCase(),
      hospitalType: String(req.body?.hospitalType || "PRIVATE").trim().toUpperCase(),
      status: String(req.body?.status || "ACTIVE").trim().toUpperCase(),
      aliases: Array.isArray(req.body?.aliases)
        ? req.body.aliases.map((v) => String(v).trim()).filter(Boolean)
        : String(req.body?.aliases || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
      location: {
        country: String(req.body?.location?.country || req.body?.country || "").trim(),
        region: String(req.body?.location?.region || req.body?.region || "").trim(),
        city: String(req.body?.location?.city || req.body?.city || "").trim(),
        address: String(req.body?.location?.address || req.body?.address || "").trim(),
      },
      contact: {
        email: String(req.body?.contact?.email || req.body?.email || "").trim(),
        phone: String(req.body?.contact?.phone || req.body?.phone || "").trim(),
      },
      approvedAt: req.body?.approvedAt ? new Date(req.body.approvedAt) : new Date(),
      validUntil: req.body?.validUntil ? new Date(req.body.validUntil) : null,
      source: {
        name: String(req.body?.source?.name || "Ministry of Health").trim(),
        referenceUrl: String(req.body?.source?.referenceUrl || "").trim(),
      },
      metadata: req.body?.metadata || {},
    };

    if (!payload.officialName || !payload.registrationNumber || !payload.location.country) {
      return res.status(400).json({ message: "officialName, registrationNumber and country are required" });
    }

    const row = await GovernmentHospitalRegistry.create(payload);
    return res.status(201).json(row);
  } catch (err) {
    console.error("Government registry create error:", err);
    return res.status(500).json({ message: "Failed to create government registry entry" });
  }
};

export const importGovernmentHospitalRegistry = async (req, res) => {
  try {
    const raw = String(req.body?.bulk || "").trim();
    if (!raw) return res.status(400).json({ message: "bulk payload is required" });

    let rows = [];
    if (raw.startsWith("[")) {
      rows = JSON.parse(raw);
    } else {
      rows = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [officialName, registrationNumber, hospitalType, country, region, city, validUntil] = line.split(",").map((v) => v.trim());
          return { officialName, registrationNumber, hospitalType, country, region, city, validUntil };
        });
    }

    const created = [];
    const skipped = [];
    for (const row of rows) {
      try {
        const entry = await GovernmentHospitalRegistry.create({
          officialName: String(row.officialName || "").trim(),
          registrationNumber: String(row.registrationNumber || "").trim().toUpperCase(),
          hospitalType: String(row.hospitalType || "PRIVATE").trim().toUpperCase(),
          location: {
            country: String(row.country || row.location?.country || "").trim(),
            region: String(row.region || row.location?.region || "").trim(),
            city: String(row.city || row.location?.city || "").trim(),
            address: String(row.address || row.location?.address || "").trim(),
          },
          status: "ACTIVE",
          validUntil: row.validUntil ? new Date(row.validUntil) : null,
        });
        created.push({ _id: entry._id, registrationNumber: entry.registrationNumber });
      } catch (err) {
        skipped.push({
          registrationNumber: row.registrationNumber || "",
          reason: err.message,
        });
      }
    }

    return res.json({ created, skipped });
  } catch (err) {
    console.error("Government registry import error:", err);
    return res.status(500).json({ message: "Failed to import government registry" });
  }
};

export const listPatientIdentityRegistry = async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const country = String(req.query?.country || "").trim().toUpperCase();
    const status = String(req.query?.status || "").trim().toUpperCase();
    const filter = {};
    if (country) filter.country = country;
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { idNumber: { $regex: q, $options: "i" } },
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
      ];
    }

    const items = await PatientIdentityRegistry.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return res.json({ items });
  } catch (err) {
    console.error("Patient identity registry list error:", err);
    return res.status(500).json({ message: "Failed to load patient identity registry" });
  }
};

export const createPatientIdentityRegistryEntry = async (req, res) => {
  try {
    const payload = {
      country: String(req.body?.country || "").trim().toUpperCase(),
      idType: String(req.body?.idType || "NATIONAL_ID").trim().toUpperCase(),
      idNumber: String(req.body?.idNumber || "").trim(),
      firstName: String(req.body?.firstName || "").trim(),
      lastName: String(req.body?.lastName || "").trim(),
      dob: req.body?.dob ? new Date(req.body.dob) : null,
      gender: String(req.body?.gender || "").trim().toUpperCase(),
      status: String(req.body?.status || "ACTIVE").trim().toUpperCase(),
      verifiedAt: req.body?.verifiedAt ? new Date(req.body.verifiedAt) : new Date(),
      source: String(req.body?.source || "NATIONAL_REGISTRY").trim(),
      metadata: req.body?.metadata || {},
    };

    if (!payload.country || !payload.idNumber) {
      return res.status(400).json({ message: "country and idNumber are required" });
    }

    const row = await PatientIdentityRegistry.create(payload);
    return res.status(201).json(row);
  } catch (err) {
    console.error("Patient identity registry create error:", err);
    return res.status(500).json({ message: "Failed to create patient identity entry" });
  }
};

export const importPatientIdentityRegistry = async (req, res) => {
  try {
    const raw = String(req.body?.bulk || "").trim();
    if (!raw) return res.status(400).json({ message: "bulk payload is required" });

    let rows = [];
    if (raw.startsWith("[")) {
      rows = JSON.parse(raw);
    } else {
      rows = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [country, idType, idNumber, firstName, lastName, dob, gender, status] = line.split(",").map((v) => v.trim());
          return { country, idType, idNumber, firstName, lastName, dob, gender, status };
        });
    }

    const created = [];
    const skipped = [];
    for (const row of rows) {
      try {
        const entry = await PatientIdentityRegistry.create({
          country: String(row.country || "").trim().toUpperCase(),
          idType: String(row.idType || "NATIONAL_ID").trim().toUpperCase(),
          idNumber: String(row.idNumber || "").trim(),
          firstName: String(row.firstName || "").trim(),
          lastName: String(row.lastName || "").trim(),
          dob: row.dob ? new Date(row.dob) : null,
          gender: String(row.gender || "").trim().toUpperCase(),
          status: String(row.status || "ACTIVE").trim().toUpperCase(),
          verifiedAt: new Date(),
        });
        created.push({ _id: entry._id, idNumber: entry.idNumber });
      } catch (err) {
        skipped.push({
          idNumber: row.idNumber || "",
          reason: err.message,
        });
      }
    }

    return res.json({ created, skipped });
  } catch (err) {
    console.error("Patient identity registry import error:", err);
    return res.status(500).json({ message: "Failed to import patient identity registry" });
  }
};

export const listClaimRules = async (req, res) => {
  try {
    const country = String(req.query?.country || "").trim().toUpperCase();
    const ruleType = String(req.query?.ruleType || "").trim().toUpperCase();
    const enabled = req.query?.enabled;
    const filter = {};
    if (country) filter.country = country;
    if (ruleType) filter.ruleType = ruleType;
    if (enabled !== undefined) filter.enabled = enabled === "true" || enabled === "1";

    const items = await ClaimRule.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ items });
  } catch (err) {
    console.error("Claim rule list error:", err);
    return res.status(500).json({ message: "Failed to load claim rules" });
  }
};

export const createClaimRule = async (req, res) => {
  try {
    const payload = {
      country: String(req.body?.country || "").trim().toUpperCase(),
      ruleType: String(req.body?.ruleType || "").trim().toUpperCase(),
      procedureCode: String(req.body?.procedureCode || "").trim().toUpperCase(),
      procedureCategory: String(req.body?.procedureCategory || "").trim().toUpperCase(),
      maxPerWindow: req.body?.maxPerWindow ?? null,
      windowDays: req.body?.windowDays ?? null,
      minAge: req.body?.minAge ?? null,
      maxAge: req.body?.maxAge ?? null,
      allowedGenders: Array.isArray(req.body?.allowedGenders)
        ? req.body.allowedGenders.map((g) => String(g).trim().toUpperCase())
        : String(req.body?.allowedGenders || "")
            .split(",")
            .map((g) => g.trim().toUpperCase())
            .filter(Boolean),
      cooldownDays: req.body?.cooldownDays ?? null,
      severity: String(req.body?.severity || "MEDIUM").trim().toUpperCase(),
      enabled: req.body?.enabled !== undefined ? Boolean(req.body.enabled) : true,
      notes: String(req.body?.notes || "").trim(),
    };

    if (!payload.ruleType) {
      return res.status(400).json({ message: "ruleType is required" });
    }
    if (!payload.procedureCode && !payload.procedureCategory) {
      return res.status(400).json({ message: "procedureCode or procedureCategory is required" });
    }

    const row = await ClaimRule.create(payload);
    return res.status(201).json(row);
  } catch (err) {
    console.error("Claim rule create error:", err);
    return res.status(500).json({ message: "Failed to create claim rule" });
  }
};

export const updateClaimRule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const fields = [
      "country",
      "ruleType",
      "procedureCode",
      "procedureCategory",
      "maxPerWindow",
      "windowDays",
      "minAge",
      "maxAge",
      "cooldownDays",
      "severity",
      "enabled",
      "notes",
      "allowedGenders",
    ];
    for (const key of fields) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.country !== undefined) updates.country = String(updates.country || "").trim().toUpperCase();
    if (updates.ruleType !== undefined) updates.ruleType = String(updates.ruleType || "").trim().toUpperCase();
    if (updates.procedureCode !== undefined) updates.procedureCode = String(updates.procedureCode || "").trim().toUpperCase();
    if (updates.procedureCategory !== undefined) updates.procedureCategory = String(updates.procedureCategory || "").trim().toUpperCase();
    if (updates.severity !== undefined) updates.severity = String(updates.severity || "MEDIUM").trim().toUpperCase();
    if (updates.allowedGenders !== undefined) {
      updates.allowedGenders = Array.isArray(updates.allowedGenders)
        ? updates.allowedGenders.map((g) => String(g).trim().toUpperCase())
        : String(updates.allowedGenders || "")
            .split(",")
            .map((g) => g.trim().toUpperCase())
            .filter(Boolean);
    }
    if (updates.enabled !== undefined) {
      updates.enabled = updates.enabled === true || updates.enabled === "true" || updates.enabled === 1 || updates.enabled === "1";
    }

    const row = await ClaimRule.findByIdAndUpdate(id, updates, { new: true });
    if (!row) return res.status(404).json({ message: "Claim rule not found" });
    return res.json(row);
  } catch (err) {
    console.error("Claim rule update error:", err);
    return res.status(500).json({ message: "Failed to update claim rule" });
  }
};

export const getHospitalVerificationReviewQueue = async (_req, res) => {
  try {
    const [hospitals, branches] = await Promise.all([
      Hospital.find({ "verification.status": "REVIEW_REQUIRED" })
        .select("name code location verification verificationDocuments createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Branch.find({ "verification.status": "REVIEW_REQUIRED" })
        .select("name parentHospitalName location verification createdAt hospital")
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return res.json({ hospitals, branches });
  } catch (err) {
    console.error("Verification review queue error:", err);
    return res.status(500).json({ message: "Failed to load review queue" });
  }
};

export const reviewHospitalVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const decision = String(req.body?.decision || "").trim().toUpperCase();
    const reviewNotes = String(req.body?.reviewNotes || "").trim();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({ message: "decision must be APPROVE or REJECT" });
    }
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    hospital.verification.status = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    hospital.verification.reviewNotes = reviewNotes;
    hospital.verification.publicVisible = decision === "APPROVE";
    hospital.verification.verifiedAt = decision === "APPROVE" ? new Date() : null;
    hospital.verification.verifiedBy = decision === "APPROVE" ? req.user?._id || null : null;
    hospital.verification.approvalDate = decision === "APPROVE" ? new Date() : null;
    await hospital.save();

    if (hospital.admins?.length) {
      await notifyUsers({
        users: hospital.admins,
        hospital: hospital._id,
        title: decision === "APPROVE" ? "Hospital Verified" : "Hospital Verification Rejected",
        body:
          decision === "APPROVE"
            ? `${hospital.name} is now government approved on AfyaLink.`
            : `${hospital.name} verification was rejected. Review notes were attached.`,
        category: "SYSTEM",
        meta: {
          type: "HOSPITAL_REVIEW_DECISION",
          decision,
        },
      });
    }

    return res.json({ success: true, hospital });
  } catch (err) {
    console.error("Hospital review error:", err);
    return res.status(500).json({ message: "Failed to review hospital verification" });
  }
};

export const streamHospitalVerificationDocument = async (req, res) => {
  try {
    const { id, documentType } = req.params;
    const hospital = await Hospital.findById(id).lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    const doc = hospital?.verificationDocuments?.[documentType];
    if (!doc?.storagePath) return res.status(404).json({ message: "Document not found" });
    await fs.access(doc.storagePath);
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName || `${documentType}.bin`}"`);
    return res.sendFile(doc.storagePath);
  } catch (err) {
    console.error("Hospital document stream error:", err);
    return res.status(500).json({ message: "Failed to open verification document" });
  }
};

export const getAdaptiveRiskPolicy = async (_req, res) => {
  try {
    const policy = await getRiskPolicy();
    res.json({ success: true, policy });
  } catch (err) {
    console.error("Risk policy read error:", err);
    res.status(500).json({ message: "Failed to load risk policy" });
  }
};

export const updateAdaptiveRiskPolicy = async (req, res) => {
  try {
    const updated = await upsertRiskPolicy(req.body || {}, req.user?._id || null);
    res.json({ success: true, policy: updated });
  } catch (err) {
    console.error("Risk policy update error:", err);
    res.status(500).json({ message: "Failed to update risk policy" });
  }
};

export const getAbacPolicies = async (req, res) => {
  try {
    const domain = String(req.query?.domain || "").trim();
    const resource = String(req.query?.resource || "").trim();
    const action = String(req.query?.action || "").trim();
    const activeOnly = req.query?.activeOnly === "1" || req.query?.activeOnly === "true";

    const filter = {};
    if (domain) filter.domain = domain;
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (activeOnly) filter.active = true;

    const items = await AbacPolicy.find(filter)
      .sort({ domain: 1, resource: 1, action: 1, priority: 1, createdAt: 1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error("ABAC policy read error:", err);
    return res.status(500).json({ message: "Failed to load ABAC policies" });
  }
};

export const upsertAbacPolicy = async (req, res) => {
  try {
    const id = req.params?.id || null;
    const domain = String(req.body?.domain || "").trim().toUpperCase();
    const resource = String(req.body?.resource || "").trim();
    const action = String(req.body?.action || "").trim();
    const effect = String(req.body?.effect || "ALLOW").trim().toUpperCase();
    const roles = Array.isArray(req.body?.roles)
      ? req.body.roles.map((r) => String(r).trim().toUpperCase()).filter(Boolean)
      : [];
    const priority = Number(req.body?.priority ?? 100);
    const active = req.body?.active !== false;
    const conditions = {
      requireActiveConsent: req.body?.conditions?.requireActiveConsent === true,
      requireSameHospitalOrPrivileged:
        req.body?.conditions?.requireSameHospitalOrPrivileged === true,
      requiredScopes: Array.isArray(req.body?.conditions?.requiredScopes)
        ? req.body.conditions.requiredScopes.map((s) => String(s).toLowerCase()).filter(Boolean)
        : [],
    };

    if (!domain || !resource || !action) {
      return res.status(400).json({ message: "domain, resource and action are required" });
    }
    if (!["ALLOW", "DENY"].includes(effect)) {
      return res.status(400).json({ message: "effect must be ALLOW or DENY" });
    }
    if (!Number.isFinite(priority) || priority < 1 || priority > 10000) {
      return res.status(400).json({ message: "priority must be between 1 and 10000" });
    }

    const update = {
      domain,
      resource,
      action,
      effect,
      roles,
      priority,
      active,
      conditions,
      updatedBy: req.user?._id || null,
    };

    const row = id
      ? await AbacPolicy.findOneAndUpdate({ _id: id }, update, { new: true })
      : await AbacPolicy.create(update);
    if (!row) return res.status(404).json({ message: "ABAC policy not found" });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_POLICY_UPSERTED",
      resource: "abac_policy",
      resourceId: row._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        domain: row.domain,
        resource: row.resource,
        actionType: row.action,
        effect: row.effect,
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json(row);
  } catch (err) {
    console.error("ABAC policy upsert error:", err);
    return res.status(500).json({ message: "Failed to save ABAC policy" });
  }
};

export const deleteAbacPolicy = async (req, res) => {
  try {
    const row = await AbacPolicy.findByIdAndDelete(req.params?.id);
    if (!row) return res.status(404).json({ message: "ABAC policy not found" });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_POLICY_DELETED",
      resource: "abac_policy",
      resourceId: row._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: { domain: row.domain, resource: row.resource, actionType: row.action },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({ ok: true, id: row._id });
  } catch (err) {
    console.error("ABAC policy delete error:", err);
    return res.status(500).json({ message: "Failed to delete ABAC policy" });
  }
};

export const simulateAbacPolicy = async (req, res) => {
  try {
    const domain = String(req.body?.domain || "").trim().toUpperCase();
    const resource = String(req.body?.resource || "").trim();
    const action = String(req.body?.action || "").trim();
    const role = String(req.body?.role || "").trim().toUpperCase();

    if (!domain || !resource || !action || !role) {
      return res.status(400).json({
        message: "domain, resource, action and role are required",
      });
    }

    const sameHospital = req.body?.sameHospital === true;
    const hasActiveConsent = req.body?.hasActiveConsent === true;
    const sourceHospitalBypass = req.body?.sourceHospitalBypass === true;
    const allowedScopes = Array.isArray(req.body?.allowedScopes)
      ? req.body.allowedScopes.map((s) => String(s).toLowerCase())
      : [];

    const result = await evaluateAbac({
      domain,
      resource,
      action,
      includeTrace: true,
      fallbackAllow: false,
      req: {
        user: { role },
        resource: {
          sameHospital,
          hasActiveConsent,
          sourceHospitalBypass,
          allowedScopes,
        },
      },
    });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_POLICY_SIMULATED",
      resource: "abac_policy",
      resourceId: null,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        input: { domain, resource, action, role, sameHospital, hasActiveConsent, sourceHospitalBypass, allowedScopes },
        decision: { allowed: result.allowed, reason: result.reason },
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({
      ok: true,
      input: { domain, resource, action, role, sameHospital, hasActiveConsent, sourceHospitalBypass, allowedScopes },
      decision: {
        allowed: result.allowed,
        reason: result.reason,
      },
      matchedPolicy: result.matchedPolicy || null,
      trace: Array.isArray(result.trace) ? result.trace : [],
    });
  } catch (err) {
    console.error("ABAC policy simulate error:", err);
    return res.status(500).json({ message: "Failed to simulate ABAC policy" });
  }
};

function toSimulationPayload(input = {}) {
  return {
    domain: String(input.domain || "").trim().toUpperCase(),
    resource: String(input.resource || "").trim(),
    action: String(input.action || "").trim(),
    role: String(input.role || "").trim().toUpperCase(),
    sameHospital: input.sameHospital === true,
    hasActiveConsent: input.hasActiveConsent === true,
    sourceHospitalBypass: input.sourceHospitalBypass === true,
    allowedScopes: Array.isArray(input.allowedScopes)
      ? input.allowedScopes.map((s) => String(s).toLowerCase())
      : [],
  };
}

async function runAbacSimulationInput(input) {
  return evaluateAbac({
    domain: input.domain,
    resource: input.resource,
    action: input.action,
    includeTrace: true,
    fallbackAllow: false,
    req: {
      user: { role: input.role },
      resource: {
        sameHospital: input.sameHospital,
        hasActiveConsent: input.hasActiveConsent,
        sourceHospitalBypass: input.sourceHospitalBypass,
        allowedScopes: input.allowedScopes,
      },
    },
  });
}

export const getAbacTestCases = async (req, res) => {
  try {
    const activeOnly = req.query?.activeOnly === "1" || req.query?.activeOnly === "true";
    const filter = activeOnly ? { active: true } : {};
    const items = await AbacPolicyTestCase.find(filter).sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("ABAC test case read error:", err);
    return res.status(500).json({ message: "Failed to load ABAC test cases" });
  }
};

export const upsertAbacTestCase = async (req, res) => {
  try {
    const id = req.params?.id || null;
    const name = String(req.body?.name || "").trim();
    const input = toSimulationPayload(req.body?.input || {});
    const expectedAllowed =
      typeof req.body?.expected?.allowed === "boolean" ? req.body.expected.allowed : null;
    const expectedReason = String(req.body?.expected?.reason || "").trim();
    const active = req.body?.active !== false;

    if (!name || !input.domain || !input.resource || !input.action || !input.role) {
      return res.status(400).json({ message: "name and valid input are required" });
    }

    const update = {
      name,
      input,
      expected: { allowed: expectedAllowed, reason: expectedReason },
      active,
      updatedBy: req.user?._id || null,
      ...(id ? {} : { createdBy: req.user?._id || null }),
    };

    const row = id
      ? await AbacPolicyTestCase.findOneAndUpdate({ _id: id }, update, { new: true })
      : await AbacPolicyTestCase.create(update);
    if (!row) return res.status(404).json({ message: "ABAC test case not found" });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_TESTCASE_UPSERTED",
      resource: "abac_policy_test_case",
      resourceId: row._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: { name: row.name, input: row.input, expected: row.expected, active: row.active },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json(row);
  } catch (err) {
    console.error("ABAC test case upsert error:", err);
    return res.status(500).json({ message: "Failed to save ABAC test case" });
  }
};

export const deleteAbacTestCase = async (req, res) => {
  try {
    const row = await AbacPolicyTestCase.findByIdAndDelete(req.params?.id);
    if (!row) return res.status(404).json({ message: "ABAC test case not found" });
    return res.json({ ok: true, id: row._id });
  } catch (err) {
    console.error("ABAC test case delete error:", err);
    return res.status(500).json({ message: "Failed to delete ABAC test case" });
  }
};

export const runAbacTestCase = async (req, res) => {
  try {
    const row = await AbacPolicyTestCase.findById(req.params?.id);
    if (!row) return res.status(404).json({ message: "ABAC test case not found" });

    const result = await runAbacSimulationInput(row.input);
    const expectedAllowed = row.expected?.allowed;
    const expectedReason = String(row.expected?.reason || "");
    const passed =
      expectedAllowed === null
        ? true
        : result.allowed === expectedAllowed &&
          (!expectedReason || expectedReason === String(result.reason || ""));

    row.lastRunAt = new Date();
    row.lastRun = {
      passed,
      allowed: result.allowed,
      reason: result.reason || "",
      matchedPolicyId: result?.matchedPolicy?._id || null,
    };
    await row.save();

    return res.json({
      id: row._id,
      name: row.name,
      passed,
      expected: row.expected,
      decision: { allowed: result.allowed, reason: result.reason },
      matchedPolicy: result.matchedPolicy || null,
      trace: Array.isArray(result.trace) ? result.trace : [],
      lastRunAt: row.lastRunAt,
    });
  } catch (err) {
    console.error("ABAC test case run error:", err);
    return res.status(500).json({ message: "Failed to run ABAC test case" });
  }
};

export const runAllAbacTestCases = async (_req, res) => {
  try {
    const rows = await AbacPolicyTestCase.find({ active: true });
    let passed = 0;
    let failed = 0;
    const results = [];

    for (const row of rows) {
      const result = await runAbacSimulationInput(row.input);
      const expectedAllowed = row.expected?.allowed;
      const expectedReason = String(row.expected?.reason || "");
      const ok =
        expectedAllowed === null
          ? true
          : result.allowed === expectedAllowed &&
            (!expectedReason || expectedReason === String(result.reason || ""));
      if (ok) passed += 1;
      else failed += 1;

      row.lastRunAt = new Date();
      row.lastRun = {
        passed: ok,
        allowed: result.allowed,
        reason: result.reason || "",
        matchedPolicyId: result?.matchedPolicy?._id || null,
      };
      await row.save();

      results.push({
        id: row._id,
        name: row.name,
        passed: ok,
        expected: row.expected,
        decision: { allowed: result.allowed, reason: result.reason },
      });
    }

    return res.json({
      ok: true,
      totals: { active: rows.length, passed, failed },
      results,
    });
  } catch (err) {
    console.error("ABAC test case run-all error:", err);
    return res.status(500).json({ message: "Failed to run ABAC test cases" });
  }
};
