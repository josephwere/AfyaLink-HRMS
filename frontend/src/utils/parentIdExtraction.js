function pickFirstValue(fields = {}, keys = []) {
  for (const key of keys) {
    const direct = fields?.[key];
    if (direct && typeof direct === "string" && direct.trim()) return direct.trim();
    const lowerMatch = Object.entries(fields || {}).find(
      ([fieldKey, value]) =>
        String(fieldKey || "").toLowerCase() === String(key || "").toLowerCase() &&
        typeof value === "string" &&
        value.trim()
    );
    if (lowerMatch) return String(lowerMatch[1]).trim();
  }
  return "";
}

function normalizeCountryCode(value = "") {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes("KENYA")) return "KE";
  if (raw.includes("UGANDA")) return "UG";
  if (raw.includes("TANZANIA")) return "TZ";
  return raw.slice(0, 2);
}

function matchFirst(text, patterns = []) {
  for (const pattern of patterns) {
    const matched = text.match(pattern);
    if (matched?.[1]) return matched[1].trim();
  }
  return "";
}

function sanitizeNationalId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^\w/-]+/g, "")
    .toUpperCase();
}

export function parseParentIdExtraction(extraction = {}) {
  const rawText = String(extraction?.rawText || extraction?.summary || "").replace(/\r/g, "\n");
  const fields = extraction?.fields && typeof extraction.fields === "object" ? extraction.fields : {};

  const nationalIdNumber = sanitizeNationalId(
    pickFirstValue(fields, [
      "nationalIdNumber",
      "idNumber",
      "documentNumber",
      "parentNationalIdNumber",
      "identityNumber",
    ]) ||
      matchFirst(rawText, [
        /(?:national\s+id|id(?:entification)?(?:\s*card)?(?:\s*no\.?|\s*number)?|identity\s*number|document\s*number)\s*[:#-]?\s*([A-Z0-9/-]{5,})/i,
        /\b([A-Z]{0,2}\d{6,12})\b/,
      ])
  );

  const displayName =
    pickFirstValue(fields, ["fullName", "name", "parentName", "holderName"]) ||
    matchFirst(rawText, [
      /(?:name|holder\s+name|full\s+name)\s*[:#-]?\s*([A-Z][A-Z' -]{5,})/i,
    ]);

  const phone =
    pickFirstValue(fields, ["phone", "mobile", "telephone", "parentPhone"]) ||
    matchFirst(rawText, [/\b(\+?\d[\d\s-]{7,}\d)\b/]);

  const nationalIdCountry = normalizeCountryCode(
    pickFirstValue(fields, ["country", "issuingCountry", "parentNationalIdCountry"]) ||
      matchFirst(rawText, [/\b(KENYA|UGANDA|TANZANIA|KE|UG|TZ)\b/i])
  );

  return {
    nationalIdNumber,
    nationalIdCountry: nationalIdCountry || "KE",
    displayName,
    phone,
    sourceSummary: String(extraction?.summary || "").trim(),
  };
}

export default {
  parseParentIdExtraction,
};
