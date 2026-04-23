const REFRESH_COOKIE_NAME = "refreshToken";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function cookieMaxAgeMs() {
  const configuredDays = Number(process.env.JWT_MAX_SESSION_DAYS || 7);
  const days = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : 7;
  return days * 24 * 60 * 60 * 1000;
}

export function refreshCookieOptions() {
  const production = isProduction();
  return {
    httpOnly: true,
    sameSite: production ? "none" : "lax",
    secure: production,
    path: "/api/auth",
    maxAge: cookieMaxAgeMs(),
  };
}

export function setRefreshTokenCookie(res, refreshToken) {
  if (!refreshToken || !res?.cookie) return;
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

export function clearRefreshTokenCookie(res) {
  if (!res?.clearCookie) return;
  const { maxAge, ...clearOptions } = refreshCookieOptions();
  void maxAge;
  res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);
}

export { REFRESH_COOKIE_NAME };
