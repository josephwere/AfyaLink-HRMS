const STARTER_PACKS = [
  {
    id: "doctor",
    label: "Doctor Pack",
    description: "Consult notes, assessment shortcuts, and charting terms for doctors and surgeons.",
    recommendedRoles: ["DOCTOR", "SURGEON"],
    dictionaryTerms: [
      { term: "sob", replacement: "shortness of breath" },
      { term: "bp", replacement: "blood pressure" },
      { term: "hr", replacement: "heart rate" },
      { term: "o2", replacement: "oxygen saturation" },
    ],
    dotPhrases: [
      { shortcut: ".opd", content: "OPD review completed. Symptoms reviewed, focused exam done, diagnosis discussed, and treatment plan explained.", scope: "global" },
      { shortcut: ".wardreview", content: "Ward review completed. Current vitals, active issues, medication plan, and escalation triggers reviewed with the bedside team.", scope: "global" },
      { shortcut: ".discharge", content: "Discharge plan explained. Medication changes, warning signs, follow-up date, and return precautions documented.", scope: "global" },
    ],
    workflowTemplates: [
      { workflow: "admissions", instructions: "Capture presenting complaint, diagnosis, bed/ward destination, handover status, and disposition notes before applying values." },
      { workflow: "referrals", instructions: "Keep referral summaries short and clinical: reason, urgency, destination, current treatment, and transport or medication notes." },
    ],
  },
  {
    id: "nurse",
    label: "Nurse Pack",
    description: "Ward handover, medication administration, and bedside workflow shortcuts for nursing teams.",
    recommendedRoles: ["NURSE"],
    dictionaryTerms: [
      { term: "iv", replacement: "intravenous" },
      { term: "po", replacement: "oral medication" },
      { term: "prn", replacement: "as needed" },
      { term: "obs", replacement: "observations" },
    ],
    dotPhrases: [
      { shortcut: ".handover", content: "Nursing handover completed. Patient status, current medications, risks, and pending tasks reviewed with the incoming shift.", scope: "global" },
      { shortcut: ".medadmin", content: "Medication administered as prescribed. Patient identity verified, dose checked, and response monitored.", scope: "global" },
      { shortcut: ".vitals", content: "Vital signs recorded, abnormal findings escalated, and the care plan updated.", scope: "global" },
    ],
    workflowTemplates: [
      { workflow: "admissions", instructions: "Prioritize patient identity, ward/bed assignment, vitals, nursing notes, and discharge or transfer readiness." },
      { workflow: "referrals", instructions: "Include patient contact, urgency, medication stock-out reason, and any nursing observations relevant to the referral." },
    ],
  },
  {
    id: "lab",
    label: "Lab Pack",
    description: "Specimen capture, result entry, and lab queue shortcuts for laboratory workflows.",
    recommendedRoles: ["LAB_TECH", "RADIOLOGIST"],
    dictionaryTerms: [
      { term: "fbc", replacement: "full blood count" },
      { term: "rbs", replacement: "random blood sugar" },
      { term: "ua", replacement: "urinalysis" },
      { term: "cxr", replacement: "chest x-ray" },
    ],
    dotPhrases: [
      { shortcut: ".sampleok", content: "Specimen received, labeled correctly, and accepted for processing.", scope: "global" },
      { shortcut: ".resultready", content: "Result reviewed for completeness, validated, and released to the requesting clinician.", scope: "global" },
      { shortcut: ".qc", content: "Quality control completed and no blocking analyzer issue detected before result release.", scope: "global" },
    ],
    workflowTemplates: [
      { workflow: "lab-orders", instructions: "Map patient name, test type, specimen, result, units, reference range, and collection or result dates exactly as provided." },
    ],
  },
  {
    id: "claims",
    label: "Claims Pack",
    description: "SHA, payer, member, and billing shortcuts for claims and reimbursement teams.",
    recommendedRoles: ["HOSPITAL_ADMIN", "PAYROLL_OFFICER", "SYSTEM_ADMIN"],
    dictionaryTerms: [
      { term: "sha", replacement: "Social Health Authority" },
      { term: "preauth", replacement: "pre-authorization" },
      { term: "mno", replacement: "member number" },
      { term: "inv", replacement: "invoice" },
    ],
    dotPhrases: [
      { shortcut: ".claimreview", content: "Claim reviewed against member details, authorization status, supporting documents, and billed services before submission.", scope: "global" },
      { shortcut: ".denyreason", content: "Claim flagged for missing authorization, incomplete patient identity, or unsupported billed service. Manual review required.", scope: "global" },
      { shortcut: ".reconcile", content: "Amounts reconciled across invoice, service lines, payer, and settlement summary.", scope: "global" },
    ],
    workflowTemplates: [
      { workflow: "claims", instructions: "Always capture member number, payer, provider, authorization code, procedure or service, amount, currency, and fraud notes. Leave unsupported fields blank." },
    ],
  },
  {
    id: "referrals",
    label: "Referral Pack",
    description: "Referral, transfer, handover, and pharmacy routing shortcuts for continuity workflows.",
    recommendedRoles: ["DOCTOR", "NURSE", "HOSPITAL_ADMIN", "COMMUNITY_HEALTH_WORKER"],
    dictionaryTerms: [
      { term: "eta", replacement: "estimated arrival time" },
      { term: "handover", replacement: "clinical handover" },
      { term: "stat", replacement: "urgent" },
      { term: "dest", replacement: "destination" },
    ],
    dotPhrases: [
      { shortcut: ".referral", content: "Referral prepared with diagnosis, urgency, current treatment, destination facility, and contact handover details.", scope: "global" },
      { shortcut: ".transport", content: "Transport readiness confirmed, receiving team notified, and referral documents attached.", scope: "global" },
      { shortcut: ".pharmref", content: "Pharmacy referral created due to stock unavailability. Medication details, urgency, and patient contact captured.", scope: "global" },
    ],
    workflowTemplates: [
      { workflow: "referrals", instructions: "Prioritize destination, urgency, patient contact, medication notes, transport readiness, and concise handover summaries." },
      { workflow: "admissions", instructions: "For transfer-to-bed workflows, map patient, ward, bed, and transfer reason before lower-priority notes." },
    ],
  },
];

function mergeByUniqueKey(existing = [], incoming = [], keyBuilder) {
  const map = new Map();
  for (const row of existing) {
    const key = keyBuilder(row);
    if (!key) continue;
    map.set(key, row);
  }
  for (const row of incoming) {
    const key = keyBuilder(row);
    if (!key) continue;
    map.set(key, row);
  }
  return Array.from(map.values());
}

export function listAssistantStarterPacks() {
  return STARTER_PACKS;
}

export function getAssistantStarterPack(id) {
  return STARTER_PACKS.find((pack) => pack.id === id) || null;
}

export function mergeAssistantStarterPack(profile = {}, pack) {
  if (!pack) return profile;
  return {
    ...profile,
    dictionaryTerms: mergeByUniqueKey(
      Array.isArray(profile.dictionaryTerms) ? profile.dictionaryTerms : [],
      pack.dictionaryTerms || [],
      (row) => String(row?.term || "").trim().toLowerCase()
    ),
    dotPhrases: mergeByUniqueKey(
      Array.isArray(profile.dotPhrases) ? profile.dotPhrases : [],
      pack.dotPhrases || [],
      (row) => String(row?.shortcut || "").trim().toLowerCase()
    ),
    workflowTemplates: mergeByUniqueKey(
      Array.isArray(profile.workflowTemplates) ? profile.workflowTemplates : [],
      pack.workflowTemplates || [],
      (row) => String(row?.workflow || "").trim().toLowerCase()
    ),
  };
}

export default {
  listAssistantStarterPacks,
  getAssistantStarterPack,
  mergeAssistantStarterPack,
};
