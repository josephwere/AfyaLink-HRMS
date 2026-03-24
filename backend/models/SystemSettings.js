import mongoose from "mongoose";

const { Schema, model } = mongoose;

const systemSettingsSchema = new Schema(
  {
    key: { type: String, default: "GLOBAL", index: true },
    branding: {
      appIcon: String,
      favicon: String,
      logo: String,
      loginBackground: String,
      homeBackground: String,
      sidebarIcons: {
        type: Map,
        of: String,
        default: {},
      },
    },
    ai: {
      enabled: { type: Boolean, default: true },
      disabledByAdmin: { type: Boolean, default: false },
      icon: { type: String, default: "" },
      name: { type: String, default: "NeuroEdge" },
      url: { type: String, default: "" },
      provider: { type: String, default: "NeuroEdge" },
      model: { type: String, default: "neuroedge-core" },
      extractionEnabled: { type: Boolean, default: true },
      digitalTwinEnabled: { type: Boolean, default: false },
      greeting: { type: String, default: "Hi, how can I help?" },
    },
    communications: {
      callsEnabled: { type: Boolean, default: true },
      videoCallsEnabled: { type: Boolean, default: true },
      voiceCallsEnabled: { type: Boolean, default: true },
    },
    clinical: {
      closeoutPolicy: {
        requireDiagnosisBeforeClose: { type: Boolean, default: true },
        requireBillingHandoffWhenPaymentsEnabled: { type: Boolean, default: true },
        requirePrescriptionWhenPharmacyEnabled: { type: Boolean, default: false },
      },
      familyAccess: {
        requireOtpForFamilyAnchor: { type: Boolean, default: true },
        allowSingleAnchorForSpouseAndChildren: { type: Boolean, default: true },
        otpTtlSeconds: { type: Number, default: 600 },
        countryPolicies: {
          type: Map,
          of: {
            fullProxyMaxAge: { type: Number, default: 15 },
            sharedAccessMinAge: { type: Number, default: 16 },
            adultAge: { type: Number, default: 18 },
            label: { type: String, default: "" },
            enabled: { type: Boolean, default: true },
          },
          default: {
            DEFAULT: {
              fullProxyMaxAge: 15,
              sharedAccessMinAge: 16,
              adultAge: 18,
              label: "Default policy",
              enabled: true,
            },
            KE: {
              fullProxyMaxAge: 15,
              sharedAccessMinAge: 16,
              adultAge: 18,
              label: "Kenya",
              enabled: true,
            },
            UG: {
              fullProxyMaxAge: 15,
              sharedAccessMinAge: 16,
              adultAge: 18,
              label: "Uganda",
              enabled: true,
            },
            TZ: {
              fullProxyMaxAge: 15,
              sharedAccessMinAge: 16,
              adultAge: 18,
              label: "Tanzania",
              enabled: true,
            },
          },
        },
      },
    },
    revenueCycle: {
      denialRiskThreshold: { type: Number, default: 65 },
      overdueInvoiceDays: { type: Number, default: 14 },
      preauthPendingSlaHours: { type: Number, default: 24 },
      targetCollectionDays: { type: Number, default: 7 },
      autoFlagHighRiskClaims: { type: Boolean, default: true },
    },
    patientSelfService: {
      defaultLanguage: { type: String, default: "en" },
      enabledLanguages: {
        type: [String],
        default: ["en", "sw", "fr"],
      },
      allowLanguageSwitch: { type: Boolean, default: true },
      voiceFirstIntake: { type: Boolean, default: false },
      whatsappSupport: { type: Boolean, default: false },
      helpLine: { type: String, default: "" },
    },
    compliance: {
      auditRetentionDays: { type: Number, default: 365 },
      messagingRetentionDays: { type: Number, default: 180 },
      evidencePackRetentionDays: { type: Number, default: 365 },
      clinicalRecordRetentionYears: { type: Number, default: 7 },
      requireStepUpForSensitiveExports: { type: Boolean, default: true },
      requireLegalHoldReason: { type: Boolean, default: true },
      requireRegionalPrivacyNotice: { type: Boolean, default: true },
      defaultRegion: { type: String, default: "KE" },
      privacyTemplates: {
        type: Map,
        of: {
          label: { type: String, default: "" },
          noticeTitle: { type: String, default: "" },
          consentSummary: { type: String, default: "" },
          breachContact: { type: String, default: "" },
          enabled: { type: Boolean, default: true },
        },
        default: {
          DEFAULT: {
            label: "Default",
            noticeTitle: "Patient privacy notice",
            consentSummary: "We use your data to deliver care, manage payments, and meet legal duties.",
            breachContact: "privacy@afyalink.health",
            enabled: true,
          },
          KE: {
            label: "Kenya",
            noticeTitle: "Kenya privacy notice",
            consentSummary: "Care, billing, consent management, and lawful health reporting are covered here.",
            breachContact: "privacy-ke@afyalink.health",
            enabled: true,
          },
          UG: {
            label: "Uganda",
            noticeTitle: "Uganda privacy notice",
            consentSummary: "Patient access, consent, and regulatory sharing are governed by this regional template.",
            breachContact: "privacy-ug@afyalink.health",
            enabled: true,
          },
          TZ: {
            label: "Tanzania",
            noticeTitle: "Tanzania privacy notice",
            consentSummary: "Clinical use, payment handling, and lawful reporting follow this regional privacy template.",
            breachContact: "privacy-tz@afyalink.health",
            enabled: true,
          },
        },
      },
    },
    governmentApis: {
      sha: {
        baseUrl: { type: String, default: "" },
        tokenUrl: { type: String, default: "" },
        preauthUrl: { type: String, default: "" },
        apiToken: { type: String, default: "" },
        clientId: { type: String, default: "" },
        clientSecret: { type: String, default: "" },
        audience: { type: String, default: "" },
        timeoutMs: { type: Number, default: 8000 },
      },
      etims: {
        baseUrl: { type: String, default: "" },
        tokenUrl: { type: String, default: "" },
        invoiceUrl: { type: String, default: "" },
        apiKey: { type: String, default: "" },
        apiToken: { type: String, default: "" },
        clientId: { type: String, default: "" },
        clientSecret: { type: String, default: "" },
        timeoutMs: { type: Number, default: 8000 },
      },
    },
    monetization: {
      strategy: { type: String, default: "CORE_FREE_PREMIUM_ADDONS" },
      enforceUsageLimits: { type: Boolean, default: false },
      featureAccess: {
        type: Map,
        of: {
          type: String,
          enum: ["FREE", "PREMIUM"],
        },
        default: {
          ai: "FREE",
          payments: "FREE",
          pharmacy: "FREE",
          inventory: "FREE",
          lab: "FREE",
          realtime: "PREMIUM",
          auditLogs: "PREMIUM",
          adminCreation: "FREE",
          advertising: "PREMIUM",
          recruitmentAds: "PREMIUM",
          advancedAnalytics: "PREMIUM",
          heavyExports: "PREMIUM",
        },
      },
    },
    migrations: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default model("SystemSettings", systemSettingsSchema);
