/**
 * ============================================
 * API Client
 * ============================================
 * One Axios instance with interceptors that handle the two things every screen
 * would otherwise repeat: attaching the access token, and transparently
 * refreshing it when it expires.
 *
 * Token strategy
 * --------------
 * The short-lived access token lives in localStorage; the long-lived refresh
 * token lives in an httpOnly cookie the browser sends automatically and
 * JavaScript cannot read. A stolen access token is useful for minutes, not
 * weeks, and XSS cannot lift the refresh token.
 *
 * Every response is unwrapped to `response.data`, so callers work with
 * `{ success, data, message }` instead of Axios's envelope.
 */

import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/index.js';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  withCredentials: true, // Send the refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// ============================================================================
// Request: attach the access token
// ============================================================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Let the browser set the multipart boundary itself; overriding it with a
    // bare "multipart/form-data" produces a request the server cannot parse.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================================
// Response: unwrap, and refresh the token on 401
// ============================================================================

/**
 * While a refresh is in flight, other 401s queue here instead of each firing
 * their own refresh. Without this, five parallel dashboard requests expiring
 * together would trigger five refreshes and four of them would fail against
 * the server's single-use rotation.
 */
let isRefreshing = false;
let queue = [];

const flushQueue = (error, token = null) => {
  queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  queue = [];
};

/** Clear local session state and send the user to the sign-in screen. */
const forceSignOut = () => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.AUTH);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
};

api.interceptors.response.use(
  (response) => response.data,

  async (error) => {
    const original = error.config;

    // ---- No response at all: offline, DNS failure, server down ----
    if (!error.response) {
      const offline = !navigator.onLine;
      return Promise.reject({
        message: offline
          ? 'You appear to be offline. Your changes have not been saved.'
          : 'Cannot reach the server. Please check that it is running and try again.',
        code: offline ? 'OFFLINE' : 'NETWORK_ERROR',
        status: 0,
        isNetworkError: true,
      });
    }

    const { status, data } = error.response;

    // ---- 401: try to refresh once ----
    const isAuthCall =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/setup');

    if (status === 401 && !original._retry && !isAuthCall) {
      if (isRefreshing) {
        // Wait for the in-flight refresh, then replay this request
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // A bare axios call, so this request does not re-enter the interceptor
        const refresh = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken = refresh.data?.data?.accessToken;
        if (!newToken) throw new Error('No token returned');

        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);
        flushQueue(null, newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        forceSignOut();
        return Promise.reject({
          message: 'Your session has ended. Please sign in again.',
          code: 'SESSION_EXPIRED',
          status: 401,
        });
      } finally {
        isRefreshing = false;
      }
    }

    // ---- Everything else: normalise into one predictable error shape ----
    return Promise.reject({
      message: data?.message || error.message || 'Something went wrong. Please try again.',
      code: data?.code || 'ERROR',
      status,
      /** Field-level validation errors, for highlighting inputs. */
      errors: data?.errors || null,
    });
  }
);

/**
 * Download a file from an endpoint that streams one (CSV, backup JSON).
 *
 * Needs its own path because the response is a Blob, not the JSON envelope the
 * interceptor above unwraps.
 *
 * @param {string} url
 * @param {object} [params]
 * @param {string} [fallbackName] Used when the server sends no filename.
 * @returns {Promise<{filename:string}>}
 */
export const downloadFromApi = async (url, params = {}, fallbackName = 'download') => {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

  const response = await axios.get(`${API_BASE_URL}${url}`, {
    params,
    responseType: 'blob',
    withCredentials: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // Prefer the server's filename from Content-Disposition
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : fallbackName;

  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

  return { filename };
};

/**
 * Is the API reachable? Used by the offline banner.
 * Deliberately short-timeout and never throws.
 */
export const checkHealth = async () => {
  try {
    const result = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    return { online: true, data: result.data?.data };
  } catch {
    return { online: false, data: null };
  }
};

export default api;
