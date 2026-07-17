const env = require("../config/env");

const ACCESS_COOKIE = "finsight_access";
const REFRESH_COOKIE = "finsight_refresh";
const CSRF_COOKIE = "finsight_csrf";

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
    domain: env.cookieDomain || undefined,
  };
}

function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  const base = baseCookieOptions();

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    maxAge: env.accessTokenTtlMs,
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: env.refreshTokenTtlMs,
    path: "/api/auth",
  });

  if (csrfToken) {
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: env.cookieSecure,
      sameSite: env.cookieSameSite,
      path: "/",
      domain: env.cookieDomain || undefined,
      maxAge: env.refreshTokenTtlMs,
    });
  }
}

function clearAuthCookies(res) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, { ...base });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/auth" });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
    domain: env.cookieDomain || undefined,
  });
}

function getAccessTokenFromRequest(req) {
  return req.cookies?.[ACCESS_COOKIE] || null;
}

function getRefreshTokenFromRequest(req) {
  return req.cookies?.[REFRESH_COOKIE] || null;
}

function getCsrfTokenFromRequest(req) {
  return req.cookies?.[CSRF_COOKIE] || null;
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  getCsrfTokenFromRequest,
};
