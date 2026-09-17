/**
 * ============================================
 * Serverless Entry Point (Vercel)
 * ============================================
 * The counterpart to `src/server.js`. That file owns a port and a process; this
 * one owns neither.
 *
 * On Vercel there is no long-running process to boot: the platform imports this
 * module, hands it a request, and may discard the whole instance immediately
 * afterwards. So the three things `server.js` does at startup - connect to
 * MongoDB, seed templates, schedule the notification sweep - cannot happen "at
 * startup" here.
 *
 *   - The connection is established on the first request and cached on the
 *     instance for every request after it (see config/db.js).
 *   - Template seeding runs once per instance, and is never allowed to fail a
 *     request.
 *   - The sweep cannot run on a timer at all, because nothing is alive between
 *     requests to fire it. It moved to api/cron/notifications.js, driven by
 *     Vercel Cron.
 *
 * `src/server.js` is untouched and still the right entry point for any host
 * that runs a real process - Render, Railway, Fly, a VPS, or `npm start`.
 */

import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDocumentTemplates } from '../src/services/template.service.js';
import env from '../src/config/env.js';

/**
 * One-time-per-instance startup, shared by every request that instance serves.
 *
 * The promise is cached rather than the result, so that concurrent requests
 * arriving during a cold start all wait on the same connection attempt instead
 * of opening one each. A failure clears the cache so the next request retries -
 * otherwise a single blip would leave the instance permanently broken for as
 * long as Vercel kept it warm.
 */
let ready = null;

const prepare = () => {
  ready ??= (async () => {
    await connectDB();

    // Seeding is idempotent and cosmetic: a missing document template can be
    // recreated from Settings, and refusing to serve the shop's dashboard over
    // it would be a far worse outcome than a missing invoice layout.
    try {
      const { created } = await seedDocumentTemplates();
      if (created.length > 0) {
        console.log(`[BOOT] Seeded document templates: ${created.join(', ')}`);
      }
    } catch (error) {
      console.error('[BOOT] Could not seed document templates:', error.message);
    }
  })().catch((error) => {
    ready = null;
    throw error;
  });

  return ready;
};

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  // A CORS preflight asks a question about policy, not about data, and the cors
  // middleware answers it without touching a collection. Gating it on the
  // database would mean that when MongoDB is unreachable the browser reports a
  // CORS failure - sending whoever is debugging it off after an origin problem
  // that does not exist.
  if (req.method === 'OPTIONS') return app(req, res);

  // The health check is the one route that must answer even when startup fails.
  // It touches no collections, and during a deployment it is the thing that
  // tells the difference between "the function is not running" and "the function
  // is running and cannot reach MongoDB" - so a database outage must not turn it
  // into the same 503 as everything else.
  if (req.url?.split('?')[0] === '/api/health') {
    // Warm the connection for whatever request comes next, but do not wait on
    // it: blocking here would make the check take the full server-selection
    // timeout to tell us the database is down, which is the one moment we most
    // need a fast answer. The route reports the live connection state instead.
    prepare().catch(() => {}); // Already logged in config/db.js
    return app(req, res);
  }

  try {
    await prepare();
  } catch (error) {
    // The database is the only hard dependency, and it being unreachable is not
    // the application's fault - so it gets a 503 with a message the front-end
    // can show, rather than the platform's generic crash page. The underlying
    // cause is already in the function log, printed by config/db.js.
    console.error('[API] Request failed during startup:', error.message);

    // This response is written directly rather than through Express, so it
    // misses the cors middleware - and a cross-origin response without those
    // headers is one the browser refuses to let the SPA read. The user would
    // then see a CORS error in the console instead of the message below, and go
    // looking for a CORS bug rather than a database outage.
    const origin = req.headers.origin;
    if (origin && env.ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(
      JSON.stringify({
        success: false,
        message: 'The service is temporarily unavailable. Please try again in a moment.',
        code: 'DATABASE_UNAVAILABLE',
      })
    );
    return;
  }

  // Vercel preserves the original request path through a rewrite, so the app
  // sees `/api/health` here exactly as it would behind nginx - which is why
  // every route in src/app.js works unchanged.
  return app(req, res);
}
