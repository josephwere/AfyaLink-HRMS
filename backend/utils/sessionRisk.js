function getIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "";
}

function getCountry(req) {
  const val =
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["x-country-code"] ||
    req.headers["x-afyalink-country"];
  return typeof val === "string" ? val.trim().toUpperCase() : "";
}

function getIpPrefix(ip) {
  if (!ip) return "";
  // IPv6 and IPv4 are both handled by rough prefixing.
  return ip.split(".").slice(0, 2).join(".") || ip.split(":").slice(0, 3).join(":");
}

function getDeviceId(req) {
  return (
    req.headers["x-device-id"] ||
    req.headers["x-afyalink-device-id"] ||
    req.headers["x-device-fingerprint"] ||
    ""
  );
}

export function assessLoginRisk(req, user, policy = null) {
  const scores = policy?.scores || {};
  const thresholds = policy?.thresholds || {};
  const ip = getIp(req);
  const country = getCountry(req);
  const deviceId = String(getDeviceId(req) || "");
  const userAgent = String(req.headers["user-agent"] || "");
  const trustedDevices = Array.isArray(user?.trustedDevices) ? user.trustedDevices : [];

  let score = 0;
  const reasons = [];

  if (!deviceId) {
    score += Number(scores.missingDeviceFingerprint ?? 15);
    reasons.push("missing_device_fingerprint");
  }

  const knownDevice = deviceId
    ? trustedDevices.find((d) => String(d.deviceId || "") === deviceId)
    : null;
  if (deviceId && !knownDevice) {
    score += Number(scores.newDevice ?? 30);
    reasons.push("new_device");
  }

  if (knownDevice?.userAgent && userAgent && knownDevice.userAgent !== userAgent) {
    score += Number(scores.userAgentChanged ?? 10);
    reasons.push("user_agent_changed");
  }

  const lastTrusted = trustedDevices[trustedDevices.length - 1];
  const lastPrefix = getIpPrefix(lastTrusted?.lastIp || "");
  const currentPrefix = getIpPrefix(ip);
  if (lastPrefix && currentPrefix && lastPrefix !== currentPrefix) {
    score += Number(scores.newNetworkPrefix ?? 35);
    reasons.push("new_network_prefix");
  }

  const lastLoginAt = user?.sessionSecurity?.lastLoginAt
    ? new Date(user.sessionSecurity.lastLoginAt)
    : null;
  const lastCountry = String(user?.sessionSecurity?.lastLoginCountry || "").toUpperCase();
  const windowMinutes = Number(policy?.impossibleTravelWindowMinutes ?? 90);
  if (lastLoginAt && lastCountry && country && lastCountry !== country) {
    const minutes = (Date.now() - lastLoginAt.getTime()) / (60 * 1000);
    if (minutes >= 0 && minutes <= windowMinutes) {
      score += Number(scores.impossibleTravel ?? 45);
      reasons.push("impossible_travel");
    }
  }

  const criticalT = Number(thresholds.critical ?? 90);
  const highT = Number(thresholds.high ?? 70);
  const mediumT = Number(thresholds.medium ?? 40);
  const level =
    score >= criticalT
      ? "CRITICAL"
      : score >= highT
      ? "HIGH"
      : score >= mediumT
      ? "MEDIUM"
      : "LOW";
  return {
    level,
    score,
    reasons,
    ip,
    country,
    deviceId,
    userAgent,
  };
}

export async function upsertTrustedDevice(user, risk) {
  const deviceId = String(risk?.deviceId || "");
  if (!deviceId) return;

  const trustedDevices = Array.isArray(user.trustedDevices) ? user.trustedDevices : [];
  const idx = trustedDevices.findIndex((d) => String(d.deviceId || "") === deviceId);
  const now = new Date();
  const patch = {
    deviceId,
    userAgent: risk.userAgent || "",
    lastUsed: now,
    lastIp: risk.ip || "",
    verifiedAt: now,
  };

  if (idx >= 0) {
    trustedDevices[idx] = { ...trustedDevices[idx].toObject?.(), ...trustedDevices[idx], ...patch };
  } else {
    trustedDevices.push({ ...patch, createdAt: now });
  }
  user.trustedDevices = trustedDevices.slice(-30);
}
