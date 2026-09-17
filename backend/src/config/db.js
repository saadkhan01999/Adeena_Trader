/**
 * ============================================
 * MongoDB Connection Manager
 * ============================================
 * Handles connection, reconnection, and graceful shutdown.
 */

import mongoose from 'mongoose';
import env from './env.js';

/**
 * Turn a connection failure into something that can be acted on.
 *
 * The driver reports a rejected TLS handshake as a raw OpenSSL string -
 * "tlsv1 alert internal error ... SSL alert number 80" - which tells the person
 * reading the terminal nothing about what to do. For MongoDB Atlas that alert
 * is precisely how the shared-tier proxy refuses a client outright, and the
 * cause is nearly always an access-list or a paused cluster rather than
 * anything wrong with this application.
 *
 * @param {Error} error The error thrown by `mongoose.connect`.
 * @returns {string[]} Lines to print underneath the failure.
 */
const diagnose = (error) => {
  const text = `${error?.message || ''} ${error?.cause?.message || ''}`;
  const usesAtlas = /mongodb\+srv/i.test(env.MONGODB_URI || '');

  // A TLS alert means the TCP connection succeeded and the server then refused
  // to complete the handshake. That is a server-side decision, not a fault in
  // the driver, the certificates on this machine, or the code.
  if (/alert (internal error|number 80)|SSL routines|ERR_SSL|tlsv1/i.test(text)) {
    const lines = [
      'The database accepted the connection but refused the TLS handshake.',
      'That is the server turning this machine away - not a problem in the code.',
    ];

    if (usesAtlas) {
      lines.push(
        '',
        'On MongoDB Atlas this is almost always one of two things:',
        '',
        '  1. This computer\'s public IP is not on the cluster access list.',
        '     Atlas -> Network Access -> ADD IP ADDRESS -> "Add Current IP Address".',
        '     Home and mobile connections are usually handed a new IP every time the',
        '     router reconnects, so an entry that worked yesterday can stop matching',
        '     today without anything else having changed.',
        '',
        '  2. The cluster is paused.',
        '     Atlas -> Database -> Resume on the cluster.'
      );
    } else {
      lines.push('', 'Check the server certificate and the TLS settings on the database host.');
    }

    return lines;
  }

  if (/Authentication failed|bad auth/i.test(text)) {
    return [
      'The database rejected the username or password.',
      'Check the credentials inside MONGODB_URI in backend/.env, and remember that',
      'a password containing @ : / ? # or % must be percent-encoded.',
    ];
  }

  if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(text)) {
    return [
      'The cluster address could not be resolved.',
      'Check the spelling of MONGODB_URI and that this machine has working DNS.',
    ];
  }

  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(text)) {
    return [
      'The database did not answer in time.',
      'Check the internet connection, and that a firewall or antivirus is not',
      'blocking outbound port 27017.',
    ];
  }

  return ['Verify MONGODB_URI in backend/.env.'];
};

/**
 * ----------------------------------------------------------------------------
 * Connection cache
 * ----------------------------------------------------------------------------
 * A long-lived server connects once at boot. A serverless function does not: it
 * is torn down and rebuilt constantly, and every cold start that opened a fresh
 * pool would add a full handshake to the request that triggered it - and, worse,
 * leak connections until Atlas starts refusing them (a free M0 cluster allows
 * 500, which a busy deploy will reach).
 *
 * The instance therefore keeps one in-flight promise and reuses it. It lives on
 * `globalThis` rather than in module scope because a bundler can evaluate the
 * same module more than once in one process, and two copies of this file would
 * otherwise mean two pools.
 *
 * A rejected promise is cleared, so a failure caused by a transient blip (or by
 * an Atlas access-list entry added a moment later) is retried on the next
 * request instead of poisoning the instance for its whole lifetime.
 */
const CACHE_KEY = Symbol.for('adeena.mongoose.connection');

const cache = globalThis[CACHE_KEY] || (globalThis[CACHE_KEY] = { promise: null });

/**
 * Connect to MongoDB with production-safe options.
 * - serverSelectionTimeoutMS: fail fast if DB unreachable
 * - maxPoolSize: connection pooling for concurrent requests
 *
 * Safe to call repeatedly: the first call connects, later calls await the same
 * promise.
 */
export const connectDB = async () => {
  if (cache.promise) return cache.promise;

  cache.promise = (async () => {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      // Kept under the platform's own request timeout (10s on Vercel's default
      // plan) so an unreachable database comes back as this application's 503
      // with a readable log line, rather than as the platform killing the
      // function mid-wait and reporting a generic timeout.
      serverSelectionTimeoutMS: env.isServerless ? 8000 : 10000,

      // Each serverless instance keeps its own pool, and there may be many
      // instances at once, so a small per-instance ceiling is what keeps the
      // total under the cluster's connection limit.
      maxPoolSize: env.isServerless ? 5 : 10,

      // Mongoose queues queries issued before the connection is ready and
      // replays them once it is. On a server that smooths over the boot window;
      // in a function it turns an unreachable database into a request that
      // hangs until the platform's timeout kills it with no useful error. The
      // handler awaits this function first, so nothing legitimate needs the
      // buffer.
      ...(env.isServerless ? { bufferCommands: false } : {}),

      family: 4, // Use IPv4, avoids some DNS issues
    });

    console.log(`\n[DB] MongoDB Connected: ${conn.connection.host}`);
    console.log(`[DB] Database: ${conn.connection.name}\n`);

    // Handle connection events after initial connect
    mongoose.connection.on('error', (err) => {
      console.error(`[DB] MongoDB error:`, err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn(`[DB] MongoDB disconnected. Attempting reconnect...`);
      // A dropped connection must not leave a resolved promise behind that
      // hands later callers a dead handle.
      if (env.isServerless) cache.promise = null;
    });

    mongoose.connection.on('reconnected', () => {
      console.log(`[DB] MongoDB reconnected.`);
    });

    return conn;
  })();

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null; // Let the next request try again

    console.error('\n[DB] Could not connect to MongoDB.');
    console.error(`[DB] ${error.message}\n`);
    for (const line of diagnose(error)) {
      console.error(line ? `[DB] ${line}` : '[DB]');
    }
    console.error('');

    // In a function there is no terminal to read and no supervisor to restart
    // us; exiting would surface as an opaque platform crash. The caller turns
    // this into a 503 the front-end can actually display.
    if (env.isServerless) throw error;
    process.exit(1);
  }
};

/**
 * Graceful shutdown - close DB connection on process exit.
 * Prevents orphaned connections and data corruption.
 */
export const disconnectDB = async () => {
  try {
    cache.promise = null;
    await mongoose.connection.close();
    console.log('[DB] MongoDB connection closed.');
  } catch (error) {
    console.error('[DB] Error closing connection:', error.message);
  }
};
