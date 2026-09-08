import crypto from "node:crypto";
import RegulatoryProduct from "../models/RegulatoryProduct.js";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;
let ppbCircuitOpenedAt = 0;
let ppbFailures = 0;

export const EVIDENCE_SOURCES = Object.freeze({
  INTERNAL_REGISTRY: "INTERNAL_REGISTRY",
  PPB_API: "PPB_API",
  GOVERNMENT_IMPORT: "GOVERNMENT_IMPORT",
  MANUAL_REGULATORY_DECISION: "MANUAL_REGULATORY_DECISION",
});

function evidenceHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
}

function normalizePpbProduct(payload, registrationNumber) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("PPB_INVALID_RESPONSE");
  const product = payload.product && typeof payload.product === "object" ? payload.product : payload;
  const normalized = {
    ...product,
    registrationNumber: product.registrationNumber || product.registration_number || registrationNumber,
    status: String(product.status || product.registrationStatus || product.registration_status || "").toUpperCase(),
    manufacturer: product.manufacturer || product.manufacturerName || "",
    registrationExpiresAt: product.registrationExpiresAt || product.registration_expiry || product.expiryDate || null,
  };
  if (!normalized.registrationNumber || !normalized.status) throw new Error("PPB_INVALID_RESPONSE");
  return normalized;
}

export function parseScanPayload(scannedCode = "") {
  const raw = String(scannedCode || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Continue with common GS1 application identifiers.
  }
  const gtin = raw.match(/(?:\(01\)|01)(\d{14})/)?.[1];
  const batchNumber = raw.match(/(?:\(10\)|10)([A-Za-z0-9./-]{1,20})/)?.[1];
  const expiry = raw.match(/(?:\(17\)|17)(\d{6})/)?.[1];
  let expiryDate;
  if (expiry) {
    const year = Number(expiry.slice(0, 2)) + 2000;
    expiryDate = `${year}-${expiry.slice(2, 4)}-${expiry.slice(4, 6)}`;
  }
  return { gtin, batchNumber, expiryDate, scanFormat: gtin ? "GS1" : "RAW" };
}

async function lookupPpb(registrationNumber, now = new Date()) {
  const baseUrl = String(process.env.PPB_REGISTRY_URL || "").trim();
  if (!baseUrl) return null;
  if (!process.env.PPB_API_KEY) throw new Error("PPB_AUTHENTICATION_NOT_CONFIGURED");
  const timeoutMs = Number(process.env.PPB_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  if (ppbCircuitOpenedAt && now.getTime() - ppbCircuitOpenedAt < timeoutMs * 2) throw new Error("PPB_CIRCUIT_OPEN");
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/products/${encodeURIComponent(registrationNumber)}`, { headers: { accept: "application/json", authorization: `Bearer ${process.env.PPB_API_KEY}` }, signal: controller.signal });
      if (!response.ok) throw new Error(`PPB_REGISTRY_${response.status}`);
      const payload = await response.json();
      ppbFailures = 0;
      ppbCircuitOpenedAt = 0;
      return { payload, requestId: response.headers.get("x-request-id") || response.headers.get("x-correlation-id") || "" };
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error("PPB_TIMEOUT") : error;
      ppbFailures += 1;
      if (ppbFailures >= 3) ppbCircuitOpenedAt = now.getTime();
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export async function verifyProductEvidence({ registrationNumber, now = new Date() }) {
  let remoteError = null;
  const configured = Boolean(String(process.env.PPB_REGISTRY_URL || "").trim());
  if (registrationNumber) {
    try {
      const ppbResult = await lookupPpb(registrationNumber, now);
      if (ppbResult?.payload) {
        const product = normalizePpbProduct(ppbResult.payload, registrationNumber);
        return { product, source: EVIDENCE_SOURCES.PPB_API, provider: "PPB", requestId: ppbResult.requestId, verifiedAt: now, responseStatus: "VERIFIED", evidenceHash: evidenceHash(product) };
      }
    } catch (error) {
      remoteError = error.message;
    }
  }
  const product = registrationNumber ? await RegulatoryProduct.findOne({ registrationNumber }).lean() : null;
  if (configured && remoteError) return { product: null, source: EVIDENCE_SOURCES.PPB_API, provider: "PPB", providerError: remoteError, responseStatus: "UNAVAILABLE", verifiedAt: now, evidenceHash: evidenceHash({ registrationNumber, providerError: remoteError }) };
  return {
    product,
    source: EVIDENCE_SOURCES.INTERNAL_REGISTRY,
    provider: "INTERNAL_REGISTRY",
    providerError: remoteError,
    responseStatus: product ? "VERIFIED" : "NOT_FOUND",
    verifiedAt: now,
    evidenceHash: evidenceHash(product || { registrationNumber, result: "NOT_FOUND" }),
  };
}
