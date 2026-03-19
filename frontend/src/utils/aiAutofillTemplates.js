function includesAny(haystack, needles) {
  const safeHaystack = String(haystack || "").toLowerCase();
  return needles.some((needle) => safeHaystack.includes(String(needle).toLowerCase()));
}

function fieldMatches(fields, needles) {
  return (fields || []).some((field) => {
    const text = [field.label, field.name, field.placeholder, field.section].filter(Boolean).join(" ").toLowerCase();
    return needles.some((needle) => text.includes(String(needle).toLowerCase()));
  });
}

const TEMPLATES = [
  {
    id: "claims",
    title: "Claims Intake",
    description: "Prioritize payer, provider, procedure, amount, and patient identifiers for claims and insurance flows.",
    match({ pathname, fields }) {
      return (
        includesAny(pathname, ["financials", "claim", "claims", "insurance"]) ||
        fieldMatches(fields, ["provider", "payer", "claim", "authorization", "member", "policy", "preauth", "amount", "currency"])
      );
    },
    promptHints: [
      "Prioritize patient identifier, payer/provider, policy/member number, authorization or pre-auth code, procedure/service, total amount, currency, and claim reason.",
      "If a claim or insurance field is missing from source evidence, leave it blank rather than inventing it.",
      "Normalize provider names to the closest visible option when a select field exists.",
    ],
  },
  {
    id: "referrals",
    title: "Referral Workflow",
    description: "Prioritize destination, patient contact, referral reason, urgency, medication notes, and handover details.",
    match({ pathname, fields }) {
      return (
        includesAny(pathname, ["referral", "transfer"]) ||
        fieldMatches(fields, ["referral", "handover", "destination", "urgent", "pharmacy", "transfer", "consent"])
      );
    },
    promptHints: [
      "Prioritize patient name, phone, referral reason, urgency, destination/provider, medication notes, and handover summary.",
      "For transfer/admission-like forms, keep the summary concise and clinically factual.",
      "If urgency is implied by words like urgent, stat, immediately, same day, set the urgency checkbox when present.",
    ],
  },
  {
    id: "lab-orders",
    title: "Lab Order / Result",
    description: "Prioritize patient details, specimen/test type, result, and collection/report dates.",
    match({ pathname, fields }) {
      return (
        includesAny(pathname, ["lab"]) ||
        fieldMatches(fields, ["test type", "result", "sample", "specimen", "patient name", "date", "lab"])
      );
    },
    promptHints: [
      "Prioritize patient name, accession/test type, specimen or sample details, result text, and date.",
      "Preserve measurement units exactly when present in the source.",
      "Avoid guessing results or dates from weak evidence.",
    ],
  },
  {
    id: "admissions",
    title: "Admission / Bed Workflow",
    description: "Prioritize patient identifiers, ward/bed, admission reason, disposition, and timeline details.",
    match({ pathname, fields }) {
      return (
        includesAny(pathname, ["beds", "ward", "inpatient", "admission"]) ||
        fieldMatches(fields, ["bed", "ward", "discharge", "admission", "inpatient", "encounter", "assign patient"])
      );
    },
    promptHints: [
      "Prioritize patient identity, ward/bed, admission or transfer reason, dates, and discharge or transfer notes.",
      "Only set bed/ward values that clearly exist in visible options or fields.",
      "If the workflow appears to be assignment rather than new admission, focus on patient and bed fields first.",
    ],
  },
];

export function resolveAutofillTemplate({ pathname, fields = [], pageTitle = "" }) {
  const found = TEMPLATES.find((template) => template.match({ pathname, fields, pageTitle }));
  return (
    found || {
      id: "generic",
      title: "General Form Fill",
      description: "Use visible page fields and provided source evidence to draft a careful autofill.",
      promptHints: [
        "Map only what is clearly supported by the source and visible fields.",
        "Prefer exact matches for select, checkbox, and radio controls.",
      ],
    }
  );
}

export default { resolveAutofillTemplate };
