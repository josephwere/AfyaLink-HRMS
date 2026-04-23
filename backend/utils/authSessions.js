import crypto from "crypto";

export const MAX_ACTIVE_REFRESH_SESSIONS = Math.max(
  Number(process.env.MAX_ACTIVE_REFRESH_SESSIONS || 8),
  1
);
export const MAX_REVOKED_REFRESH_SESSIONS = Math.max(
  Number(process.env.MAX_REVOKED_REFRESH_SESSIONS || 40),
  8
);

function hashRefreshToken(refreshToken = "") {
  return crypto.createHash("sha256").update(String(refreshToken || "")).digest("hex");
}

function toIso(value, fallback = new Date().toISOString()) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function cloneSessionRecord(record = {}) {
  const sessionId = String(record?.sessionId || "").trim();
  const tokenHash = String(record?.tokenHash || "").trim();
  if (!sessionId && !tokenHash) return null;

  return {
    sessionId: sessionId || `sess_${tokenHash.slice(0, 24)}`,
    tokenHash,
    startedAt: toIso(record?.startedAt),
    lastSeenAt: toIso(record?.lastSeenAt || record?.startedAt),
    lastRotatedAt: toIso(record?.lastRotatedAt || record?.lastSeenAt || record?.startedAt),
    lastIp: String(record?.lastIp || ""),
    country: String(record?.country || ""),
    userAgent: String(record?.userAgent || ""),
    source: String(record?.source || "SESSION"),
    revokedAt: record?.revokedAt ? toIso(record.revokedAt) : null,
    revokeReason: String(record?.revokeReason || ""),
    revocationSource: String(record?.revocationSource || ""),
  };
}

function ensureSessionSecurity(user) {
  const current =
    user?.sessionSecurity && typeof user.sessionSecurity === "object"
      ? user.sessionSecurity.toObject?.() || { ...user.sessionSecurity }
      : {};

  return {
    ...current,
    activeSessions: Array.isArray(current.activeSessions)
      ? current.activeSessions.map(cloneSessionRecord).filter(Boolean)
      : [],
    revokedSessions: Array.isArray(current.revokedSessions)
      ? current.revokedSessions.map(cloneSessionRecord).filter(Boolean)
      : [],
  };
}

function dedupeRefreshTokens(tokens = []) {
  const seen = new Set();
  const next = [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = String(tokens[index] || "").trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    next.push(token);
  }
  return next.reverse();
}

function dedupeSessionRecords(records = []) {
  const map = new Map();
  (records || []).forEach((record) => {
    const next = cloneSessionRecord(record);
    if (!next) return;
    const key = next.sessionId || next.tokenHash;
    if (!key) return;
    map.set(key, next);
  });
  return Array.from(map.values());
}

function appendRevokedSession(revokedSessions = [], session, reason, source = "SYSTEM") {
  const entry = cloneSessionRecord({
    ...session,
    revokedAt: new Date().toISOString(),
    revokeReason: reason,
    revocationSource: source,
  });
  if (!entry) return revokedSessions;
  const filtered = (revokedSessions || []).filter(
    (row) => row.sessionId !== entry.sessionId && row.tokenHash !== entry.tokenHash
  );
  return [...filtered, entry].slice(-MAX_REVOKED_REFRESH_SESSIONS);
}

function sessionSortTime(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sessionBaseRecord({
  refreshToken,
  sessionId,
  startedAt,
  req,
  risk,
  source = "SESSION",
  existing = null,
}) {
  const tokenHash = hashRefreshToken(refreshToken);
  const resolvedSessionId = String(sessionId || existing?.sessionId || `sess_${tokenHash.slice(0, 24)}`);
  const nowIso = new Date().toISOString();

  return {
    sessionId: resolvedSessionId,
    tokenHash,
    startedAt: toIso(existing?.startedAt || startedAt || nowIso, nowIso),
    lastSeenAt: nowIso,
    lastRotatedAt: nowIso,
    lastIp: String(risk?.ip || req?.ip || existing?.lastIp || ""),
    country: String(risk?.country || existing?.country || ""),
    userAgent: String(req?.headers?.["user-agent"] || existing?.userAgent || ""),
    source: String(source || existing?.source || "SESSION"),
  };
}

function pruneOverflowSessions(user, sessionSecurity, reason = "SESSION_LIMIT_EVICTED") {
  let activeSessions = dedupeSessionRecords(sessionSecurity.activeSessions);
  let revokedSessions = dedupeSessionRecords(sessionSecurity.revokedSessions);
  let refreshTokens = dedupeRefreshTokens(user.refreshTokens || []);

  if (activeSessions.length > MAX_ACTIVE_REFRESH_SESSIONS) {
    const overflowCount = activeSessions.length - MAX_ACTIVE_REFRESH_SESSIONS;
    const evicted = [...activeSessions]
      .sort((a, b) => sessionSortTime(a.lastSeenAt) - sessionSortTime(b.lastSeenAt))
      .slice(0, overflowCount);
    const evictedHashes = new Set(evicted.map((row) => row.tokenHash));

    activeSessions = activeSessions.filter((row) => !evictedHashes.has(row.tokenHash));
    refreshTokens = refreshTokens.filter((token) => !evictedHashes.has(hashRefreshToken(token)));
    evicted.forEach((session) => {
      revokedSessions = appendRevokedSession(revokedSessions, session, reason, "SESSION_POLICY");
    });
  }

  user.refreshTokens = refreshTokens;
  user.sessionSecurity = {
    ...sessionSecurity,
    activeSessions,
    revokedSessions,
  };
}

export function createSessionId() {
  return crypto.randomUUID();
}

export function resolveSessionId(refreshToken, preferredSessionId = "") {
  const tokenHash = hashRefreshToken(refreshToken);
  return String(preferredSessionId || `sess_${tokenHash.slice(0, 24)}`);
}

export function registerRefreshSession(
  user,
  { refreshToken, sessionId = "", startedAt = null, req = null, risk = null, source = "LOGIN" } = {}
) {
  if (!user || !refreshToken) return;
  const sessionSecurity = ensureSessionSecurity(user);
  const refreshTokens = dedupeRefreshTokens([...(user.refreshTokens || []), refreshToken]);
  const activeSessions = dedupeSessionRecords(sessionSecurity.activeSessions);
  const resolvedSessionId = resolveSessionId(refreshToken, sessionId);
  const existingIndex = activeSessions.findIndex(
    (session) => session.sessionId === resolvedSessionId || session.tokenHash === hashRefreshToken(refreshToken)
  );
  const existing = existingIndex >= 0 ? activeSessions[existingIndex] : null;
  const nextSession = sessionBaseRecord({
    refreshToken,
    sessionId: resolvedSessionId,
    startedAt,
    req,
    risk,
    source,
    existing,
  });

  if (existingIndex >= 0) {
    activeSessions[existingIndex] = nextSession;
  } else {
    activeSessions.push(nextSession);
  }

  user.refreshTokens = refreshTokens;
  user.sessionSecurity = {
    ...sessionSecurity,
    activeSessions,
    revokedSessions: dedupeSessionRecords(sessionSecurity.revokedSessions),
  };
  pruneOverflowSessions(user, user.sessionSecurity);
}

export function rotateRefreshSession(
  user,
  {
    previousRefreshToken,
    nextRefreshToken,
    sessionId = "",
    startedAt = null,
    req = null,
    risk = null,
    source = "REFRESH",
  } = {}
) {
  if (!user || !nextRefreshToken) return;
  const sessionSecurity = ensureSessionSecurity(user);
  const activeSessions = dedupeSessionRecords(sessionSecurity.activeSessions);
  const previousHash = previousRefreshToken ? hashRefreshToken(previousRefreshToken) : "";
  const resolvedSessionId = resolveSessionId(nextRefreshToken, sessionId);
  const existingIndex = activeSessions.findIndex(
    (session) => session.sessionId === resolvedSessionId || (previousHash && session.tokenHash === previousHash)
  );
  const existing = existingIndex >= 0 ? activeSessions[existingIndex] : null;
  const nextSession = sessionBaseRecord({
    refreshToken: nextRefreshToken,
    sessionId: resolvedSessionId,
    startedAt,
    req,
    risk,
    source,
    existing,
  });

  if (existingIndex >= 0) {
    activeSessions[existingIndex] = nextSession;
  } else {
    activeSessions.push(nextSession);
  }

  const refreshTokens = dedupeRefreshTokens([
    ...(user.refreshTokens || []).filter((token) => token !== previousRefreshToken),
    nextRefreshToken,
  ]);

  user.refreshTokens = refreshTokens;
  user.sessionSecurity = {
    ...sessionSecurity,
    activeSessions,
    revokedSessions: dedupeSessionRecords(sessionSecurity.revokedSessions),
  };
  pruneOverflowSessions(user, user.sessionSecurity);
}

export function revokeRefreshSession(
  user,
  { refreshToken = "", sessionId = "", reason = "LOGOUT", source = "USER" } = {}
) {
  if (!user) return;
  const sessionSecurity = ensureSessionSecurity(user);
  const activeSessions = dedupeSessionRecords(sessionSecurity.activeSessions);
  const tokenHash = refreshToken ? hashRefreshToken(refreshToken) : "";
  const matchedIndex = activeSessions.findIndex(
    (session) => (sessionId && session.sessionId === sessionId) || (tokenHash && session.tokenHash === tokenHash)
  );

  let revokedSessions = dedupeSessionRecords(sessionSecurity.revokedSessions);
  if (matchedIndex >= 0) {
    const [matched] = activeSessions.splice(matchedIndex, 1);
    revokedSessions = appendRevokedSession(revokedSessions, matched, reason, source);
  } else if (refreshToken || sessionId) {
    revokedSessions = appendRevokedSession(
      revokedSessions,
      {
        sessionId: resolveSessionId(refreshToken || sessionId, sessionId),
        tokenHash: tokenHash || hashRefreshToken(sessionId || refreshToken),
        startedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        lastRotatedAt: new Date().toISOString(),
        source,
      },
      reason,
      source
    );
  }

  user.refreshTokens = (user.refreshTokens || []).filter((token) => token !== refreshToken);
  user.sessionSecurity = {
    ...sessionSecurity,
    activeSessions,
    revokedSessions,
  };
}

export function revokeAllRefreshSessions(
  user,
  { reason = "GLOBAL_LOGOUT", source = "SYSTEM" } = {}
) {
  if (!user) return;
  const sessionSecurity = ensureSessionSecurity(user);
  const activeSessions = dedupeSessionRecords(sessionSecurity.activeSessions);
  let revokedSessions = dedupeSessionRecords(sessionSecurity.revokedSessions);

  activeSessions.forEach((session) => {
    revokedSessions = appendRevokedSession(revokedSessions, session, reason, source);
  });

  const activeHashes = new Set(activeSessions.map((session) => session.tokenHash));
  (user.refreshTokens || []).forEach((token) => {
    const tokenHash = hashRefreshToken(token);
    if (activeHashes.has(tokenHash)) return;
    revokedSessions = appendRevokedSession(
      revokedSessions,
      {
        sessionId: resolveSessionId(token),
        tokenHash,
        startedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        lastRotatedAt: new Date().toISOString(),
        source,
      },
      reason,
      source
    );
  });

  user.refreshTokens = [];
  user.sessionSecurity = {
    ...sessionSecurity,
    activeSessions: [],
    revokedSessions,
  };
}
