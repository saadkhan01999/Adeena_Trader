/**
 * ============================================
 * Bootstrap Script
 * ============================================
 * Creates the MINIMUM data the system needs to run:
 * an administrator, the product categories this business trades in, the
 * business profile, application settings, Zakat settings and the document
 * templates.
 *
 * This is NOT sample or demo data. Nothing here invents a customer, a sale or
 * a figure - the shop's real records are entered through the application.
 *
 * Idempotent: every step checks before it writes, so running it twice is safe
 * and never overwrites anything an administrator has already configured.
 *
 *   npm run seed
 */

import mongoose from 'mongoose';
import env from '../config/env.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Settings from '../models/Settings.js';
import { ZakatSettings } from '../models/Zakat.js';
import { seedDocumentTemplates } from '../services/template.service.js';
import { DEFAULT_CATEGORIES, BUSINESS_DEFAULTS, ROLES } from '../constants/index.js';

/** Consistent, readable console output. */
const log = {
  step: (msg) => console.log(`\n[SEED] ${msg}`),
  done: (msg) => console.log(`       ${msg}`),
  skip: (msg) => console.log(`       (skipped) ${msg}`),
  warn: (msg) => console.log(`       WARNING: ${msg}`),
};

const seedDatabase = async () => {
  try {
    log.step('Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    log.done(`Connected to "${mongoose.connection.name}".`);

    // ----------------------------------------------------------------
    // 1. Administrator
    // ----------------------------------------------------------------
    log.step('Administrator account');
    const existingAdmin = await User.findOne({ role: ROLES.ADMIN });

    if (existingAdmin) {
      log.skip(`An administrator already exists (${existingAdmin.email}).`);
    } else {
      await User.create({
        name: env.DEFAULT_ADMIN_NAME,
        username: env.DEFAULT_ADMIN_USERNAME,
        email: env.DEFAULT_ADMIN_EMAIL,
        password: env.DEFAULT_ADMIN_PASSWORD,
        role: ROLES.ADMIN,
        isActive: true,
        // Force a password change on first sign-in - the bootstrap password is
        // written in a .env file and must not remain the live credential.
        mustChangePassword: true,
      });

      log.done('Administrator created.');
      log.done(`  Username : ${env.DEFAULT_ADMIN_USERNAME}`);
      log.done(`  Email    : ${env.DEFAULT_ADMIN_EMAIL}`);
      log.done(`  Password : ${env.DEFAULT_ADMIN_PASSWORD}`);
      log.warn('Change this password immediately after signing in.');
    }

    // ----------------------------------------------------------------
    // 2. Product categories
    // ----------------------------------------------------------------
    log.step('Product categories');
    let created = 0;

    for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
      // Check per category rather than "are there any?" so a shop that deleted
      // one category gets it back without duplicating the others.
      const exists = await Category.findOne({ name: category.name });
      if (exists) continue;

      await Category.create({ ...category, displayOrder: index + 1, status: 'active' });
      created += 1;
    }

    log.done(created > 0 ? `${created} category/categories created.` : 'All categories already present.');

    // ----------------------------------------------------------------
    // 3. Business profile
    // ----------------------------------------------------------------
    log.step('Business profile');
    const existingProfile = await BusinessProfile.findOne();

    if (existingProfile) {
      log.skip(`"${existingProfile.name}" is already configured.`);
    } else {
      await BusinessProfile.create(BUSINESS_DEFAULTS);
      log.done(`"${BUSINESS_DEFAULTS.name}" created. Update it in Settings > Business.`);
    }

    // ----------------------------------------------------------------
    // 4. Application settings
    // ----------------------------------------------------------------
    log.step('Application settings');
    const hadSettings = Boolean(await Settings.findOne());
    await Settings.getSingleton(); // Creates with schema defaults when missing
    log.done(hadSettings ? 'Already configured.' : 'Created with default values.');

    // ----------------------------------------------------------------
    // 5. Zakat settings
    // ----------------------------------------------------------------
    log.step('Zakat settings');
    const hadZakat = Boolean(await ZakatSettings.findOne());
    const zakat = await ZakatSettings.getSingleton();

    if (hadZakat) {
      log.skip('Already configured.');
    } else {
      log.done('Created. Rate 2.5%, Nisab based on the silver threshold (612.36 g).');
      log.warn('Enter the current silver rate per gram in Zakat Settings to set the Nisab.');
    }

    if (!zakat.nisab) {
      log.warn('Nisab is not set yet - Zakat cannot be calculated until it is.');
    }

    // ----------------------------------------------------------------
    // 6. Document templates
    // ----------------------------------------------------------------
    log.step('Document templates');
    const templates = await seedDocumentTemplates();
    log.done(
      templates.created.length > 0
        ? `Created: ${templates.created.join(', ')}.`
        : 'All templates already present.'
    );
    if (templates.created.length > 0) {
      log.warn('Review the agreement wording in Settings > Documents with your legal adviser.');
    }

    console.log('\n========================================');
    console.log('  BOOTSTRAP COMPLETE');
    console.log('========================================');
    console.log('  Start the app with:  npm run dev');
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n[SEED] Failed:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ServerSelection')) {
      console.error('[SEED] Check MONGODB_URI in backend/.env and that the database is reachable.\n');
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();
