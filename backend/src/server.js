/**
 * ============================================
 * Server Entry Point
 * ============================================
 * Connects to MongoDB, prepares first-run data, starts HTTP, schedules the
 * notification sweep, and shuts everything down cleanly on a signal.
 */

import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedDocumentTemplates } from './services/template.service.js';
import { runNotificationSweep } from './services/notification.service.js';

/**
 * Work that must happen once, after the database is up but before traffic is
 * accepted. Failures here are logged rather than fatal: a missing template can
 * be re-seeded from Settings, and refusing to boot over it would take the whole
 * shop offline for a cosmetic problem.
 */
const bootstrap = async () => {
  try {
    const { created } = await seedDocumentTemplates();
    if (created.length > 0) {
      console.log(`[BOOT] Seeded document templates: ${created.join(', ')}`);
    }
  } catch (error) {
    console.error('[BOOT] Could not seed document templates:', error.message);
  }
};

/**
 * Schedule the recurring notification sweep.
 *
 * `setInterval` is used rather than a cron library because the job is a single
 * fixed-interval task inside one process - adding a scheduler dependency would
 * buy nothing. The timer is unref'd so it never keeps the process alive during
 * shutdown, and the first run is delayed to let the server finish starting.
 *
 * @returns {NodeJS.Timeout|null} The handle, so shutdown can clear it.
 */
const scheduleNotificationSweep = () => {
  const minutes = env.NOTIFICATION_SWEEP_MINUTES;
  if (minutes <= 0) {
    console.log('[JOBS] Notification sweep disabled (NOTIFICATION_SWEEP_MINUTES=0).');
    return null;
  }

  const sweep = async () => {
    try {
      const result = await runNotificationSweep();
      if (!result.skipped) {
        const total = Object.values(result.created).reduce((a, b) => a + b, 0);
        if (total > 0) console.log(`[JOBS] Notification sweep raised ${total} new alert(s).`);
      }
    } catch (error) {
      console.error('[JOBS] Notification sweep failed:', error.message);
    }
  };

  // First run 30s after boot - long enough for the connection pool to settle.
  const kickoff = setTimeout(sweep, 30_000);
  kickoff.unref();

  const interval = setInterval(sweep, minutes * 60 * 1000);
  interval.unref();

  console.log(`[JOBS] Notification sweep scheduled every ${minutes} minute(s).`);
  return interval;
};

const startServer = async () => {
  try {
    await connectDB();
    await bootstrap();

    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log('\n========================================');
      console.log('  ADEENA TRADERS API');
      console.log('========================================');
      console.log(`  Environment : ${env.NODE_ENV}`);
      console.log(`  Port        : ${env.PORT}`);
      console.log(`  Client      : ${env.CLIENT_URL}`);
      console.log(`  API base    : http://localhost:${env.PORT}/api`);
      console.log(`  Health      : http://localhost:${env.PORT}/api/health`);
      console.log(`  Uploads     : ${env.UPLOAD_DIR}`);
      console.log('========================================\n');
    });

    /**
     * A port clash is the most common startup failure in development - a
     * previous run, or nodemon restarting before the old process let go. It is
     * not a crash, so it gets a plain instruction instead of a stack trace.
     */
    server.on('error', async (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n[SERVER] Port ${env.PORT} is already in use.`);
        console.error('[SERVER] Another copy of the API is probably still running.');
        console.error('[SERVER] Stop it, or set a different PORT in backend/.env:');
        console.error(`[SERVER]   Windows : netstat -ano | findstr :${env.PORT}`);
        console.error('[SERVER]             taskkill /PID <pid> /F');
        console.error(`[SERVER]   macOS   : lsof -ti:${env.PORT} | xargs kill -9\n`);
      } else {
        console.error('[SERVER] Failed to listen:', error.message);
      }

      await disconnectDB();
      process.exit(1);
    });

    const sweepTimer = scheduleNotificationSweep();

    // ---- Graceful shutdown -------------------------------------------
    let shuttingDown = false;

    const shutdown = async (signal) => {
      if (shuttingDown) return; // A second Ctrl+C must not re-enter this
      shuttingDown = true;

      console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
      if (sweepTimer) clearInterval(sweepTimer);

      // Stop accepting new connections, let in-flight requests finish
      server.close(async () => {
        await disconnectDB();
        console.log('[SERVER] Shutdown complete.');
        process.exit(0);
      });

      // A stuck keep-alive connection must not hold the process open forever
      setTimeout(() => {
        console.error('[SERVER] Forced shutdown after 10s timeout.');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // An unhandled rejection is a bug, but it is not necessarily fatal - log it
    // loudly and keep serving rather than dropping every active user.
    process.on('unhandledRejection', (reason) => {
      console.error('[SERVER] Unhandled promise rejection:', reason);
    });

    // An uncaught exception leaves the process in an unknown state, so the only
    // safe response is to shut down and let the supervisor restart us.
    process.on('uncaughtException', (error) => {
      console.error('[SERVER] Uncaught exception:', error);
      shutdown('uncaughtException');
    });
  } catch (error) {
    console.error('[SERVER] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
