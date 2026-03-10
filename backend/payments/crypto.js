import fetch from "node-fetch";
import crypto from "crypto";

const baseUrl = process.env.COINBASE_COMMERCE_BASE_URL || "https://api.commerce.coinbase.com";
const apiKey = process.env.COINBASE_COMMERCE_KEY || "";

async function createCharge({ amount, currency = "USD", name, email, metadata = {} } = {}) {
  if (!apiKey) {
    throw new Error("Crypto provider not configured");
  }

  const body = {
    name: "AfyaLink Payment",
    description: "Healthcare service payment",
    local_price: {
      amount: Number(amount || 0).toFixed(2),
      currency,
    },
    pricing_type: "fixed_price",
    metadata: {
      transactionId: metadata?.transactionId,
      customerName: name,
      customerEmail: email,
    },
  };

  const res = await fetch(`${baseUrl}/charges`, {
    method: "POST",
    headers: {
      "X-CC-Version": "2018-03-22",
      "X-CC-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Crypto charge creation failed");
  }

  return {
    status: "pending",
    chargeId: data?.data?.id,
    hostedUrl: data?.data?.hosted_url,
  };
}

export default {
  createCharge,
  handleWebhook,
};

export function handleWebhook(body, headers = {}) {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET || "";
  const signature =
    headers["x-cc-webhook-signature"] ||
    headers["X-CC-Webhook-Signature"] ||
    headers["x-cc-webhook-signature".toLowerCase()] ||
    "";

  if (secret && signature) {
    const payload = JSON.stringify(body);
    const computed = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");
    if (computed !== signature) {
      throw new Error("Invalid Coinbase Commerce webhook signature");
    }
  }

  const event = body?.event || {};
  const type = event?.type || "";
  const data = event?.data || {};
  const reference = data?.id || "";
  let status = "pending";
  if (type === "charge:failed") status = "failed";
  if (type === "charge:confirmed" || type === "charge:resolved") status = "success";

  return {
    reference,
    status,
    meta: body,
  };
}
