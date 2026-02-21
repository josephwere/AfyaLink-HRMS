// notifications/pushClient.js
import webpush from 'web-push';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('VAPID keys not configured - push will use placeholder');
}

export async function sendPush(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('Push not configured - placeholder');
    return { ok: true, placeholder: true };
  }
  try {
    const res = await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, res };
  } catch (err) {
    console.error('Push send error', err);
    throw err;
  }
}
