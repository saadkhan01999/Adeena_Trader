/**
 * ============================================
 * Refresh-Cookie Policy
 * ============================================
 * Decides the SameSite and Secure attributes for the refresh-token cookie.
 *
 * Why this is not a constant
 * --------------------------
 * SameSite=Strict is the right choice when the SPA and the API answer on the
 * same host, and a silent outage when they do not. A browser simply will not
 * attach a Strict cookie to a cross-site request, so `POST /api/auth/refresh`
 * arrives without it, the server correctly answers 401, and every user is
 * signed out the moment their 15-minute access token expires. Nothing is logged
 * anywhere, because nothing went wrong from either side's point of view.
 *
 * This application is deployed in both shapes - one origin behind a single
 * nginx, and a split deployment with the SPA on Vercel and the API on Railway -
 * so the answer is derived per request by comparing where the request came from
 * with where it arrived. COOKIE_SAME_SITE overrides the comparison when you
 * need to force a specific answer.
 */

import env from '../config/env.js';

/** Hostname of an Origin header, or null when it is absent or unparseable. */
const originHost = (origin) => {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * The host this request actually arrived on.
 *
 * `req.hostname` is used rather than the raw Host header because Express
 * resolves X-Forwarded-Host through it - and on Railway, Vercel, or behind
 * nginx the Host header describes the proxy, not the public name the browser
 * used. Comparing against the proxy's name would make every request look
 * cross-site.
 */
const requestHost = (req) =>
  String(req?.hostname || req?.headers?.host || '').toLowerCase().split(':')[0];

/**
 * Is this request actually running over HTTPS?
 *
 * `req.secure` reads X-Forwarded-Proto when `trust proxy` is set (it is, in
 * app.js), which is the only way to tell on a platform that terminates TLS at
 * its edge and forwards plain HTTP internally - Railway, Vercel and nginx all
 * do this, so the socket itself always looks insecure.
 */
const isSecure = (req) =>
  Boolean(req?.secure) || req?.headers?.['x-forwarded-proto'] === 'https';

/**
 * @param {import('express').Request} req
 * @returns {'none'|'lax'|'strict'}
 */
export const resolveSameSite = (req) => {
  if (env.COOKIE_SAME_SITE) return env.COOKIE_SAME_SITE;

  const from = originHost(req?.headers?.origin);

  // No Origin, or an origin matching the host it arrived on, means this is not
  // a cross-site request: a same-origin call, a navigation, curl, or a
  // server-to-server call. Strict works there and is the tighter choice.
  const crossSite = Boolean(from) && from !== requestHost(req);
  if (!crossSite) return env.isProduction ? 'strict' : 'lax';

  // Cross-site leaves exactly one option the browser will actually send, and it
  // is only honoured on a Secure cookie.
  //
  // This deliberately does not consult NODE_ENV. A split deployment is
  // cross-site whether or not anyone remembered to set that variable on the API
  // host, and getting it wrong costs a silent sign-out fifteen minutes after
  // every login - far too quiet a failure to hang on an environment variable
  // that is this easy to forget.
  if (isSecure(req)) return 'none';

  // Cross-origin over plain HTTP: the browser would drop a None cookie for
  // lacking Secure, so Lax at least keeps a local cross-port setup working.
  return 'lax';
};

/**
 * Cookie options for the refresh token, consistent across set and clear.
 *
 * `clearCookie` only removes a cookie when its attributes match the ones it was
 * set with, which is why both paths go through this single function.
 *
 * @param {import('express').Request} req
 * @param {boolean} rememberMe Extend the lifetime to COOKIE_EXPIRES_DAYS.
 */
export const refreshCookieOptions = (req, rememberMe = false) => {
  const sameSite = resolveSameSite(req);

  return {
    httpOnly: true, // Unreadable from JavaScript, so XSS cannot steal it

    // SameSite=None is only honoured on a Secure cookie - a browser drops it
    // otherwise - so the two attributes always move together.
    secure: sameSite === 'none' ? true : env.isProduction,

    sameSite,
    path: '/',
    maxAge: (rememberMe ? env.COOKIE_EXPIRES_DAYS : 1) * 24 * 60 * 60 * 1000,
  };
};
