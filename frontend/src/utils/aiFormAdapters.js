function includesAny(haystack, needles) {
  const safe = String(haystack || "").toLowerCase();
  return needles.some((needle) => safe.includes(String(needle).toLowerCase()));
}

function fieldText(field) {
  return [field.label, field.name, field.placeholder, field.section, ...(field.aliases || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesField(field, needles) {
  const haystack = fieldText(field);
  return needles.some((needle) => haystack.includes(String(needle).toLowerCase()));
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function mergeField(field, extras = {}) {
  return {
    ...field,
    aliases: uniqueStrings([...(field.aliases || []), ...(extras.aliases || [])]),
    widget: extras.widget || field.widget || "",
    intent: extras.intent || field.intent || "",
    priority: extras.priority || field.priority || "normal",
    helpText: extras.helpText || field.helpText || "",
  };
}

const ADAPTERS = [
  {
    id: "receptionist-booking",
    title: "Receptionist Booking Adapter",
    description: "Targets front-desk patient lookup and quick-booking controls without treating result tables as fill targets.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["receptionist/bookingdesk", "bookingdesk"]) ||
        includesAny(pageTitle, ["front desk booking", "booking desk", "quick booking"]) ||
        (fields || []).some((field) => matchesField(field, ["patient search", "booking service", "preferred appointment time"]))
      );
    },
    promptHints: [
      "Front-desk booking pages need patient lookup, service, consultation type, preferred time, reason, and preferred doctor.",
      "If the page only exposes a patient search box and a manual results table, fill the search box and booking details but do not assume a patient row was selected.",
    ],
    adaptField(field) {
      if (matchesField(field, ["patient search", "find patient"])) {
        return mergeField(field, {
          aliases: ["patient lookup", "front desk patient search", "search by national id"],
          widget: "patient-search",
          intent: "lookup",
          priority: "high",
        });
      }
      if (matchesField(field, ["booking service", "service"])) {
        return mergeField(field, {
          aliases: ["service type", "appointment service", "clinic service"],
          priority: "high",
        });
      }
      if (matchesField(field, ["consultation type"])) {
        return mergeField(field, {
          aliases: ["consultation mode", "appointment mode", "visit mode"],
          priority: "high",
        });
      }
      if (matchesField(field, ["preferred appointment time", "preferred time"])) {
        return mergeField(field, {
          aliases: ["booking time", "appointment date and time", "visit time"],
          priority: "high",
        });
      }
      if (matchesField(field, ["appointment reason", "reason"])) {
        return mergeField(field, {
          aliases: ["visit reason", "booking reason", "chief complaint"],
          priority: "high",
        });
      }
      return field;
    },
  },
  {
    id: "patient-appointments",
    title: "Patient Appointment Adapter",
    description: "Matches location, nearest-hospital, doctor, and appointment booking controls on patient self-service pages.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["patient/myappointments", "myappointments"]) ||
        includesAny(pageTitle, ["my appointments", "book appointment"]) ||
        (fields || []).some((field) =>
          matchesField(field, ["nearest hospital", "appointment date & time", "doctor search"])
        )
      );
    },
    promptHints: [
      "Patient appointment pages usually require location or a selected hospital before booking details can be applied.",
      "De-prioritize location controls unless the instruction includes coordinates, GPS, location label, or nearest-hospital selection.",
    ],
    adaptField(field) {
      if (matchesField(field, ["location mode", "latitude", "longitude", "search radius", "location label"])) {
        return mergeField(field, {
          intent: "location",
          priority: matchesField(field, ["latitude", "longitude"]) ? "medium" : "low",
        });
      }
      if (matchesField(field, ["nearest hospital", "hospital"])) {
        return mergeField(field, {
          aliases: ["selected hospital", "booking hospital", "facility"],
          widget: "hospital-picker",
          priority: "high",
        });
      }
      if (matchesField(field, ["doctor search"])) {
        return mergeField(field, {
          aliases: ["doctor lookup", "find doctor", "preferred doctor search"],
          intent: "lookup",
          priority: "medium",
        });
      }
      if (matchesField(field, ["preferred doctor", "doctor"])) {
        return mergeField(field, {
          aliases: ["selected doctor", "assigned doctor", "doctor picker"],
          widget: "doctor-picker",
          priority: "high",
        });
      }
      if (matchesField(field, ["appointment service", "appointment date & time", "consultation type", "appointment reason"])) {
        return mergeField(field, { priority: "high" });
      }
      return field;
    },
  },
  {
    id: "community-health-worker",
    title: "Community Health Worker Adapter",
    description: "Boosts section-specific household, maternal, child, vaccination, surveillance, chronic care, and referral forms.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["communityhealthworker", "/chw", "chw"]) ||
        includesAny(pageTitle, ["community health worker", "chw"]) ||
        (fields || []).some((field) =>
          matchesField(field, ["household search", "maternal household", "child household", "referral urgency"])
        )
      );
    },
    promptHints: [
      "Community health worker pages contain multiple independent forms. Fill only the section relevant to the instruction instead of mixing maternal, child, vaccination, chronic care, disease surveillance, and referrals.",
      "Household search is usually a filter, while household selectors inside forms are actual clinical-entry targets.",
    ],
    adaptField(field) {
      if (matchesField(field, ["household search"])) {
        return mergeField(field, {
          aliases: ["search household", "find household", "chw search"],
          intent: "filter",
          priority: "low",
        });
      }
      if (matchesField(field, ["household", "visit household", "maternal household", "child household", "vaccination household", "chronic follow-up household"])) {
        return mergeField(field, {
          aliases: ["selected household", "family household", "community household"],
          widget: "household-picker",
          priority: matchesField(field, ["household search"]) ? "low" : "high",
        });
      }
      if (matchesField(field, ["receiving hospital", "referral hospital"])) {
        return mergeField(field, {
          aliases: ["destination hospital", "receiving facility", "referral destination"],
          widget: "hospital-picker",
          priority: "high",
        });
      }
      if (matchesField(field, ["referral urgency", "severity", "household risk level", "nutrition risk", "medication compliance", "cold chain status"])) {
        return mergeField(field, { priority: "high" });
      }
      if (matchesField(field, ["next visit date", "next action date", "expected delivery date", "follow-up date"])) {
        return mergeField(field, {
          aliases: ["review date", "planned visit date", "return date"],
          priority: "high",
        });
      }
      if (matchesField(field, ["visit notes", "maternal notes", "child growth notes", "follow-up notes", "disease report notes", "referral summary"])) {
        return mergeField(field, { priority: "high" });
      }
      return field;
    },
  },
  {
    id: "claims-workflows",
    title: "Claims Workflow Adapter",
    description: "Boost matching for payer, member, authorization, and billed amount fields.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["financials", "claim", "claims", "insurance"]) ||
        includesAny(pageTitle, ["claim", "insurance", "financial"]) ||
        (fields || []).some((field) => matchesField(field, ["payer", "member", "policy", "preauth", "invoice", "claim"]))
      );
    },
    promptHints: [
      "De-prioritize filters or dashboard controls unless the instruction explicitly asks to filter records.",
      "Claims workflows usually need payer, member number, provider, authorization, service date, and total amount before free-text notes.",
    ],
    adaptField(field) {
      if (matchesField(field, ["payer", "insurance", "health fund"])) {
        return mergeField(field, {
          aliases: ["health fund", "insurance provider", "payer name", "scheme"],
          widget: "payer-selector",
          priority: "high",
        });
      }
      if (matchesField(field, ["member", "policy", "nhif", "sha"])) {
        return mergeField(field, {
          aliases: ["member number", "policy number", "sha member number", "national health fund number"],
          priority: "high",
        });
      }
      if (matchesField(field, ["amount", "total", "invoice", "bill"])) {
        return mergeField(field, {
          aliases: ["claim amount", "billed amount", "invoice total", "charge amount"],
          priority: "high",
        });
      }
      if (matchesField(field, ["authorization", "preauth", "approval"])) {
        return mergeField(field, {
          aliases: ["pre-authorization", "approval code", "auth code"],
          priority: "high",
        });
      }
      return field;
    },
  },
  {
    id: "referral-workflows",
    title: "Referral Workflow Adapter",
    description: "Matches destination, urgency, medication, and handover controls for referral and transfer pages.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["referral", "transfer"]) ||
        includesAny(pageTitle, ["referral", "transfer", "pharmacy"]) ||
        (fields || []).some((field) => matchesField(field, ["handover", "urgent", "pharmacy", "destination", "transfer"]))
      );
    },
    promptHints: [
      "Prefer destination, urgency, patient contact, medication notes, and handover summary over search fields.",
      "If the page contains location or radius controls, only fill them when the instruction explicitly mentions geolocation.",
    ],
    adaptField(field) {
      if (matchesField(field, ["pharmacy", "destination", "nearest pharmacies"])) {
        return mergeField(field, {
          aliases: ["destination pharmacy", "receiving pharmacy", "referral destination", "dispensing pharmacy"],
          widget: "pharmacy-directory-picker",
          priority: "high",
        });
      }
      if (matchesField(field, ["patient phone", "contact"])) {
        return mergeField(field, {
          aliases: ["phone number", "patient contact", "mobile number"],
          priority: "high",
        });
      }
      if (matchesField(field, ["reason", "referral reason"])) {
        return mergeField(field, {
          aliases: ["handover reason", "transfer reason", "clinical reason"],
          priority: "high",
        });
      }
      if (matchesField(field, ["urgent"])) {
        return mergeField(field, {
          aliases: ["stat", "priority", "urgent case"],
          priority: "high",
        });
      }
      if (matchesField(field, ["latitude", "longitude", "radius"])) {
        return mergeField(field, {
          intent: "location-filter",
          priority: "low",
        });
      }
      if (matchesField(field, ["search pharmacy"])) {
        return mergeField(field, {
          intent: "lookup",
          priority: "low",
        });
      }
      return field;
    },
  },
  {
    id: "lab-workflows",
    title: "Lab Workflow Adapter",
    description: "Boosts extraction for specimen, test type, result, and report-date fields.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["lab"]) ||
        includesAny(pageTitle, ["laboratory", "lab"]) ||
        (fields || []).some((field) => matchesField(field, ["test type", "specimen", "result", "sample"]))
      );
    },
    promptHints: [
      "Lab workflows usually prioritize patient identity, test type, specimen, result, units, and dates.",
      "Do not overwrite results with generic text when the source only contains a request and not a completed result.",
    ],
    adaptField(field) {
      if (matchesField(field, ["patient name"])) {
        return mergeField(field, {
          aliases: ["lab patient", "specimen patient", "patient full name"],
          priority: "high",
        });
      }
      if (matchesField(field, ["test type"])) {
        return mergeField(field, {
          aliases: ["investigation", "ordered test", "lab test", "requested test"],
          priority: "high",
        });
      }
      if (matchesField(field, ["result"])) {
        return mergeField(field, {
          aliases: ["finding", "lab finding", "reported result", "impression"],
          priority: "high",
        });
      }
      if (matchesField(field, ["date"])) {
        return mergeField(field, {
          aliases: ["collection date", "report date", "result date"],
          priority: "medium",
        });
      }
      if (matchesField(field, ["search"])) {
        return mergeField(field, { intent: "lookup", priority: "low" });
      }
      return field;
    },
  },
  {
    id: "admissions-beds",
    title: "Admission & Bed Board Adapter",
    description: "Targets hospital, ward, bed, patient assignment, transfer, and discharge controls.",
    match({ pathname, pageTitle, fields }) {
      return (
        includesAny(pathname, ["beds", "ward", "admission", "inpatient"]) ||
        includesAny(pageTitle, ["beds", "ward", "admission"]) ||
        (fields || []).some((field) => matchesField(field, ["bed", "ward", "discharge", "assign patient", "target bed"]))
      );
    },
    promptHints: [
      "De-prioritize bed filters and dashboards unless the request is about filtering occupancy.",
      "For admissions and transfers, focus first on hospital, ward, bed, patient assignment, transfer target, and discharge notes.",
    ],
    adaptField(field) {
      if (matchesField(field, ["hospital"])) {
        return mergeField(field, {
          aliases: ["facility", "site", "bed scope hospital"],
          widget: "hospital-scope-selector",
          priority: "high",
        });
      }
      if (matchesField(field, ["ward"])) {
        return mergeField(field, {
          aliases: ["unit", "ward name", "inpatient ward"],
          priority: matchesField(field, ["filter"]) ? "low" : "high",
          intent: matchesField(field, ["all wards", "filters"]) ? "filter" : field.intent,
        });
      }
      if (matchesField(field, ["bed number", "target bed"])) {
        return mergeField(field, {
          aliases: ["bed", "bed assignment", "transfer bed"],
          widget: "bed-selector",
          priority: "high",
        });
      }
      if (matchesField(field, ["patient search"])) {
        return mergeField(field, {
          aliases: ["patient lookup", "find patient", "assign patient search"],
          intent: "lookup",
          priority: "medium",
        });
      }
      if (matchesField(field, ["select patient", "assigned patient"])) {
        return mergeField(field, {
          aliases: ["patient", "bed patient", "selected patient"],
          widget: "patient-picker",
          priority: "high",
        });
      }
      if (matchesField(field, ["discharge note"])) {
        return mergeField(field, {
          aliases: ["discharge summary", "release note", "disposition note"],
          priority: "high",
        });
      }
      if (matchesField(field, ["status", "all beds"])) {
        return mergeField(field, { intent: "filter", priority: "low" });
      }
      return field;
    },
  },
  {
    id: "training-tracker",
    title: "Training Tracker Adapter",
    description: "Targets trainee plan forms while lowering the importance of tracker filters.",
    match({ pathname, pageTitle }) {
      return includesAny(pathname, ["training-tracker"]) || includesAny(pageTitle, ["training tracker"]);
    },
    promptHints: [
      "Prioritize the trainee plan form over list filters unless the instruction explicitly says to filter or search the tracker.",
    ],
    adaptField(field) {
      if (matchesField(field, ["search trainee", "search registered worker"])) {
        return mergeField(field, {
          aliases: ["worker search", "trainee lookup"],
          intent: "lookup",
          priority: "medium",
        });
      }
      if (matchesField(field, ["search results"])) {
        return mergeField(field, {
          aliases: ["selected trainee", "worker result"],
          widget: "worker-picker",
          priority: "high",
        });
      }
      if (matchesField(field, ["trainee role"])) {
        return mergeField(field, {
          aliases: ["staff role", "worker role", "onboarding role"],
          priority: "high",
        });
      }
      if (matchesField(field, ["manual trainee name"])) {
        return mergeField(field, {
          aliases: ["trainee name", "worker name"],
          priority: "high",
        });
      }
      if (matchesField(field, ["manual trainee email"])) {
        return mergeField(field, {
          aliases: ["trainee email", "worker email"],
          priority: "medium",
        });
      }
      if (matchesField(field, ["trainer notes"])) {
        return mergeField(field, {
          aliases: ["training notes", "onboarding notes", "trainer context"],
          priority: "high",
        });
      }
      if (matchesField(field, ["filters", "search trainee name", "hospital id", "all roles", "all status"])) {
        return mergeField(field, { intent: "filter", priority: "low" });
      }
      return field;
    },
  },
];

export function resolvePageFormAdapter({ pathname, fields = [], pageTitle = "" }) {
  return (
    ADAPTERS.find((adapter) => adapter.match({ pathname, fields, pageTitle })) || {
      id: "generic",
      title: "Generic Adapter",
      description: "Fallback form adapter.",
      promptHints: [],
      adaptField(field) {
        return field;
      },
    }
  );
}

export function adaptPageFormFields({ pathname, fields = [], pageTitle = "" }) {
  const adapter = resolvePageFormAdapter({ pathname, fields, pageTitle });
  return fields.map((field) => adapter.adaptField(field));
}

export default {
  adaptPageFormFields,
  resolvePageFormAdapter,
};
