import fetch from "node-fetch";

const baseUrl = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
const clientId = process.env.PAYPAL_CLIENT_ID || "";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";

async function getAccessToken() {
  if (!clientId || !clientSecret) {
    throw new Error("PayPal client credentials not configured");
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || "Failed to obtain PayPal token");
  }
  return data.access_token;
}

async function createOrder({ amount, currency = "USD", metadata = {} } = {}) {
  const token = await getAccessToken();
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: Number(amount || 0).toFixed(2),
        },
        custom_id: metadata?.transactionId || undefined,
      },
    ],
    application_context: {
      brand_name: "AfyaLink",
      user_action: "PAY_NOW",
    },
  };

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "PayPal order creation failed");
  }

  const approval = Array.isArray(data?.links)
    ? data.links.find((l) => l.rel === "approve")
    : null;

  return {
    status: "pending",
    orderId: data?.id,
    approvalLink: approval?.href,
  };
}

export default {
  createOrder,
  handleWebhook,
};

export function handleWebhook(body, _headers = {}) {
  const eventType = body?.event_type || body?.eventType || "";
  const resource = body?.resource || {};
  const reference =
    resource?.supplementary_data?.related_ids?.order_id ||
    resource?.id ||
    body?.resource?.id ||
    "";
  let status = "pending";
  if (eventType.toUpperCase().includes("COMPLETED")) status = "success";
  if (eventType.toUpperCase().includes("DENIED") || eventType.toUpperCase().includes("FAILED")) {
    status = "failed";
  }
  return {
    reference,
    status,
    meta: body,
  };
}
