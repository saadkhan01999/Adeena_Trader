/**
 * ============================================
 * Notification Sweep (Vercel Cron)
 * ============================================
 * The serverless replacement for the `setInterval` in src/server.js.
 *
 * Nothing is alive between requests in a function, so a timer cannot survive to
 * fire. Vercel Cron calls this endpoint on the schedule in vercel.json instead,
 * and the sweep itself is unchanged - only what triggers it has moved.
 */

import { connectDB } from '../../src/config/db.js';
import { runNotificationSweep } from '../../src/services/notification.service.js';
import env from '../../src/config/env.js';

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const reply = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };

  // ---- Authorisation -------------------------------------------------------
  // The URL is public, and the sweep is a write-heavy pass over the whole
  // database, so it must not be runnable by anyone who guesses the path. Vercel
  // sends `Authorization: Bearer $CRON_SECRET` on every cron invocation when
  // that variable is set on the project.
  //
  // An unset secret is refused rather than waved through: defaulting to open
  // would leave the endpoint exposed on a deployment where someone simply
  // forgot the variable, and that is the case most likely to go unnoticed.
  if (!env.CRON_SECRET) {
    console.error('[CRON] CRON_SECRET is not set - refusing to run the sweep.');
    return reply(500, {
      success: false,
      message: 'CRON_SECRET is not configured on this deployment.',
      code: 'CRON_SECRET_MISSING',
    });
  }

  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    return reply(401, { success: false, message: 'Unauthorized.', code: 'UNAUTHORIZED' });
  }

  // ---- Sweep ---------------------------------------------------------------
  try {
    await connectDB();
    const result = await runNotificationSweep();

    if (result.skipped) {
      console.log('[CRON] Notification sweep skipped.');
      return reply(200, { success: true, data: { skipped: true } });
    }

    const total = Object.values(result.created).reduce((a, b) => a + b, 0);
    console.log(`[CRON] Notification sweep raised ${total} new alert(s).`);

    return reply(200, { success: true, data: { skipped: false, total, created: result.created } });
  } catch (error) {
    console.error('[CRON] Notification sweep failed:', error.message);
    return reply(500, {
      success: false,
      message: 'Notification sweep failed.',
      code: 'SWEEP_FAILED',
    });
  }
}
