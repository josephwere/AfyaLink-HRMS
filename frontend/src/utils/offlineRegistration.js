import { resolveApiBase } from "./networkBase";

const OFFLINE_REG_KEY = "afyalink_offline_registrations_v1";

function nowIso() {
  return new Date().toISOString();
}

function readQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_REG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(OFFLINE_REG_KEY, JSON.stringify(items || []));
}

export function enqueueOfflineRegistration(payload) {
  const queue = readQueue();
  queue.push({
    id: `oreg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    payload,
  });
  writeQueue(queue);
  return queue[queue.length - 1];
}

export function listOfflineRegistrations() {
  return readQueue();
}

export async function flushOfflineRegistrations() {
  const queue = readQueue();
  if (!queue.length || !navigator.onLine) {
    return { synced: 0, pending: queue.length, failed: 0 };
  }
  const remaining = [];
  let synced = 0;
  let failed = 0;
  const base = resolveApiBase(import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "");

  for (const item of queue) {
    try {
      const res = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item.payload),
      });
      if (!res.ok) {
        failed += 1;
        remaining.push(item);
      } else {
        synced += 1;
      }
    } catch {
      failed += 1;
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return { synced, pending: remaining.length, failed };
}
