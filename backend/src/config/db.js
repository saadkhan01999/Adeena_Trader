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
 * Connect to MongoDB with production-safe options.
 * - serverSelectionTimeoutMS: fail fast if DB unreachable
 * - maxPoolSize: connection pooling for concurrent requests
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
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
    });

    mongoose.connection.on('reconnected', () => {
      console.log(`[DB] MongoDB reconnected.`);
    });

    return conn;
  } catch (error) {
    console.error('\n[DB] Could not connect to MongoDB.');
    console.error(`[DB] ${error.message}\n`);
    for (const line of diagnose(error)) {
      console.error(line ? `[DB] ${line}` : '[DB]');
    }
    console.error('');
    process.exit(1);
  }
};

/**
 * Graceful shutdown - close DB connection on process exit.
 * Prevents orphaned connections and data corruption.
 */
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[DB] MongoDB connection closed.');
  } catch (error) {
    console.error('[DB] Error closing connection:', error.message);
  }
};
