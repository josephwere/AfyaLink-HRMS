import axios from "axios";
import { ensureConfigured, getEtimsCredentials } from "./integrationCredentials.js";

const isProd = process.env.NODE_ENV === "production";

async function getEtimsAccessToken(config) {
  if (config?.hasApiToken) return process.env.ETIMS_API_TOKEN;
  if (config?.hasApiKey) return process.env.ETIMS_API_KEY;
  if (!config?.tokenUrl) throw new Error("ETIMS token URL missing");

  const payload = new URLSearchParams({ grant_type: "client_credentials" });
  const auth = Buffer.from(`${process.env.ETIMS_CLIENT_ID}:${process.env.ETIMS_CLIENT_SECRET}`).toString("base64");
  const { data } = await axios.post(config.tokenUrl, payload.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: config.timeoutMs || 8000,
  });
  return data?.access_token || data?.accessToken || data?.token;
}

export async function submitEtimsInvoice({ invoice, hospital }) {
  const config = getEtimsCredentials();

  if (!config.configured) {
    if (isProd) ensureConfigured(config, { allowInNonProd: false });
    return { status: "SKIPPED", reason: "eTIMS not configured" };
  }

  const token = await getEtimsAccessToken(config);
  if (!token) throw new Error("ETIMS access token missing");

  const payload = {
    invoiceId: invoice?._id || invoice?.invoiceNumber || "",
    hospitalId: hospital?._id || hospital?.code || "",
    hospitalName: hospital?.name || "",
    amount: Number(invoice?.total || 0),
    currency: invoice?.currency || "KES",
    issuedAt: invoice?.createdAt || new Date().toISOString(),
    lineItems: Array.isArray(invoice?.items) ? invoice.items : [],
  };

  const { data } = await axios.post(config.invoiceUrl, payload, {
    headers: {
      Authorization: config.hasApiKey ? `ApiKey ${token}` : `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: config.timeoutMs || 8000,
  });

  return {
    status: "SUBMITTED",
    receiptId: data?.receiptId || data?.id || null,
    raw: data,
  };
}

export async function testEtimsConnection() {
  const config = getEtimsCredentials();
  if (!config.configured) {
    if (isProd) ensureConfigured(config, { allowInNonProd: false });
    return { ok: false, reason: "eTIMS not configured" };
  }

  const token = await getEtimsAccessToken(config);
  if (!token) throw new Error("ETIMS access token missing");

  const { data } = await axios.get(config.invoiceUrl, {
    headers: {
      Authorization: config.hasApiKey ? `ApiKey ${token}` : `Bearer ${token}`,
    },
    timeout: config.timeoutMs || 8000,
  });

  return { ok: true, data };
}
