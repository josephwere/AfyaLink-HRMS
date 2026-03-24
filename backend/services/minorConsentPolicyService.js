function normalizeCountryCode(value = "") {
  return String(value || "").trim().toUpperCase();
}

const POLICY_SEEDS = Object.freeze({
  DEFAULT: {
    fullProxyMaxAge: 15,
    sharedAccessMinAge: 16,
    adultAge: 18,
    label: "Default family access policy",
    note:
      "Seeded from common teen proxy-portal patterns. Review local legal and hospital policy requirements before changing production thresholds.",
  },
  KE: {
    fullProxyMaxAge: 15,
    sharedAccessMinAge: 16,
    adultAge: 18,
    label: "Kenya family access policy",
    note:
      "Children are treated as under 18. Ages 16-17 default to shared teen access until local policy says otherwise.",
  },
  UG: {
    fullProxyMaxAge: 15,
    sharedAccessMinAge: 16,
    adultAge: 18,
    label: "Uganda family access policy",
    note:
      "Children are treated as under 18. Ages 16-17 default to shared teen access until local policy says otherwise.",
  },
  TZ: {
    fullProxyMaxAge: 15,
    sharedAccessMinAge: 16,
    adultAge: 18,
    label: "Tanzania family access policy",
    note:
      "Children are treated as under 18. Ages 16-17 default to shared teen access until local policy says otherwise.",
  },
});

function basePermissions(mode) {
  if (mode === "SHARED_TEEN_ACCESS") {
    return {
      appointments: true,
      careNavigation: true,
      billing: true,
      medications: true,
      vaccinations: true,
      labResultSummaries: true,
      detailedClinicalNotes: false,
      reportContentPreview: false,
      confidentialResults: false,
    };
  }

  return {
    appointments: true,
    careNavigation: true,
    billing: true,
    medications: true,
    vaccinations: true,
    labResultSummaries: true,
    detailedClinicalNotes: true,
    reportContentPreview: true,
    confidentialResults: true,
  };
}

export function resolveMinorConsentPolicy({ age = null, countryCode = "" } = {}) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const seed = POLICY_SEEDS[normalizedCountryCode] || POLICY_SEEDS.DEFAULT;

  if (age === null || Number.isNaN(Number(age))) {
    return {
      mode: "UNKNOWN",
      age: null,
      countryCode: normalizedCountryCode || "DEFAULT",
      label: seed.label,
      note: seed.note,
      permissions: basePermissions("FULL_PARENT_PROXY"),
      thresholds: {
        fullProxyMaxAge: seed.fullProxyMaxAge,
        sharedAccessMinAge: seed.sharedAccessMinAge,
        adultAge: seed.adultAge,
      },
    };
  }

  if (Number(age) >= seed.adultAge) {
    return {
      mode: "ADULT_CONSENT_REQUIRED",
      age: Number(age),
      countryCode: normalizedCountryCode || "DEFAULT",
      label: seed.label,
      note: "Once the patient becomes an adult, parent access must rely on direct patient consent or legal representation.",
      permissions: {
        appointments: false,
        careNavigation: false,
        billing: false,
        medications: false,
        vaccinations: false,
        labResultSummaries: false,
        detailedClinicalNotes: false,
        reportContentPreview: false,
        confidentialResults: false,
      },
      thresholds: {
        fullProxyMaxAge: seed.fullProxyMaxAge,
        sharedAccessMinAge: seed.sharedAccessMinAge,
        adultAge: seed.adultAge,
      },
    };
  }

  const mode = Number(age) >= seed.sharedAccessMinAge ? "SHARED_TEEN_ACCESS" : "FULL_PARENT_PROXY";
  return {
    mode,
    age: Number(age),
    countryCode: normalizedCountryCode || "DEFAULT",
    label: seed.label,
    note:
      mode === "SHARED_TEEN_ACCESS"
        ? "Teen shared access is active. Parents keep coordination and billing visibility, while detailed confidential content should stay limited."
        : "Full parent proxy access is active for this child.",
    permissions: basePermissions(mode),
    thresholds: {
      fullProxyMaxAge: seed.fullProxyMaxAge,
      sharedAccessMinAge: seed.sharedAccessMinAge,
      adultAge: seed.adultAge,
    },
  };
}

export default {
  resolveMinorConsentPolicy,
};
