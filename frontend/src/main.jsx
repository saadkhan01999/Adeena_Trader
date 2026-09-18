/**
 * ============================================
 * Application Entry Point
 * ============================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Register the service worker that keeps the app usable when the shop's
 * internet drops. See public/sw.js for what it does and does not cache.
 *
 * Production only: in development a cached shell means edits do not appear,
 * which costs more time than it saves. Registration is deliberately deferred
 * to `load` so it never competes with the first paint, and a failure is
 * logged rather than surfaced - the app works without it.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Deferred off the critical path, but NOT hung off `load`. The page pulls a
  // webfont from a third party, and if that request stalls - a slow link, a
  // blocked CDN - `load` never fires and the worker is never registered, so
  // the offline support quietly does not exist on exactly the connections
  // that need it most. A timeout yields to first paint just as well and
  // depends on nothing outside the page.
  setTimeout(() => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('[SW] Registration failed:', error.message));
  }, 1200);
}
