import axios from "axios";
import { ensureConfigured, getShaCredentials } from "./integrationCredentials.js";

/**
 * SHA SERVICE
 * - External insurance integration
 * - Fails closed in production when credentials are missing
 * - NEVER mutates workflow directly
 */

const isProd = process.env.NODE_ENV === "production";

function normalizeShaResponse(data = {}) {
  const rawStatus = String(data?.status || data?.decision || "").toUpperCase();
  const approved =
    rawStatus === "APPROVED" ||
    rawStatus === "ACCEPTED" ||
    data?.approved === true ||
    data?.authorized === true;

  return {
    status: approved ? "APPROVED" : "REJECTED",
    authorizationCode:
      data?.authorizationCode ||
      data?.authCode ||
      data?.authorization_id ||
      (approved ? `SHA-${Date.now()}` : ""),
    reason: data?.reason || data?.message || data?.error || "Rejected by SHA",
    raw: data,
  };
}

async function getShaAccessToken(config) {
  if (config?.hasApiToken) return process.env.SHA_API_TOKEN;
  if (!config?.tokenUrl) throw new Error("SHA token URL missing");

  const payload = new URLSearchParams({ grant_type: "client_credentials" });
  if (config?.audience) payload.set("audience", config.audience);

  const auth = Buffer.from(`${process.env.SHA_CLIENT_ID}:${process.env.SHA_CLIENT_SECRET}`).toString("base64");
  const { data } = await axios.post(config.tokenUrl, payload.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: config.timeoutMs || 8000,
  });

  const token = data?.access_token || data?.accessToken || data?.token;
  if (!token) throw new Error("SHA token response missing access_token");
  return token;
}

export async function requestShaPreauth({ encounter, patient }) {
  const config = getShaCredentials();

  if (!config.configured) {
    if (isProd) {
      ensureConfigured(config, { allowInNonProd: false });
    }

    if (process.env.SHA_MOCK_MODE === "1") {
      await new Promise((r) => setTimeout(r, 300));
      return {
        status: "APPROVED",
        authorizationCode: `SHA-MOCK-${Date.now()}`,
      };
    }

    await new Promise((r) => setTimeout(r, 150));
    return {
      status: "REJECTED",
      reason: "SHA integration not configured",
    };
  }

  const payload = {
    encounterId: encounter?._id,
    patientId: patient?._id,
    patient: {
      name: patient?.name || `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim(),
      nationalId: patient?.nationalId || patient?.countryId || "",
      dob: patient?.dob || null,
      gender: patient?.gender || "",
      phone: patient?.phone || "",
    },
    provider: "SHA",
    estimatedCost: Number(encounter?.costEstimate || encounter?.billing?.estimatedTotal || 0),
    diagnosis: encounter?.diagnosis || encounter?.summary || "",
    createdAt: new Date().toISOString(),
  };

  try {
    const token = await getShaAccessToken(config);
    const { data } = await axios.post(config.preauthUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: config.timeoutMs || 8000,
    });

    return normalizeShaResponse(data);
  } catch (err) {
    const reason = err?.response?.data?.message || err?.response?.data?.error || err.message || "SHA preauth failed";
    if (isProd) {
      return { status: "REJECTED", reason };
    }
    return { status: "REJECTED", reason: `SHA integration error: ${reason}` };
  }
}
