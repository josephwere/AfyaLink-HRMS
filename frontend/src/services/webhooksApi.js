import apiFetch from "../utils/apiFetch";

export async function sendWebhook(source, body) {
  return apiFetch(`/api/webhooks/${source}`, { method: "POST", body });
}

export default { sendWebhook };
