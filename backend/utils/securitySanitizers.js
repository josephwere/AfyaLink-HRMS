function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripControlChars(value) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ");
}

export function sanitizeString(value, { trim = true, maxLength = 500, preserveNewlines = false } = {}) {
  if (value === undefined || value === null) return "";
  let normalized = String(value).replace(/[<>]/g, "");
  normalized = preserveNewlines
    ? normalized.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    : stripControlChars(normalized).replace(/\s+/g, " ");
  if (trim) normalized = normalized.trim();
  if (Number.isFinite(maxLength) && maxLength > 0) {
    normalized = normalized.slice(0, maxLength);
  }
  return normalized;
}

export function sanitizeEmail(value) {
  return sanitizeString(value, { maxLength: 254 }).toLowerCase();
}

export function sanitizePhone(value) {
  return sanitizeString(value, { maxLength: 32 }).replace(/[^+\d]/g, "");
}

export function sanitizeIdentifier(value) {
  return sanitizeString(value, { maxLength: 160 }).replace(/\s+/g, "");
}

export function sanitizeCode(value) {
  return sanitizeString(value, { maxLength: 64 }).toUpperCase();
}

export function sanitizeObjectTree(value, depth = 0) {
  if (depth > 5) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return sanitizeString(value, { maxLength: 4000, preserveNewlines: true });
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => sanitizeObjectTree(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const next = {};
  Object.entries(value).forEach(([key, child]) => {
    const safeKey = sanitizeString(key, { maxLength: 120 });
    if (!safeKey || safeKey.startsWith("$") || safeKey.includes(".")) return;
    const safeChild = sanitizeObjectTree(child, depth + 1);
    if (safeChild !== undefined) {
      next[safeKey] = safeChild;
    }
  });
  return next;
}
