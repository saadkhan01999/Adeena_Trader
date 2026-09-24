/**
 * ============================================
 * StoredFile Model
 * ============================================
 * An uploaded file kept in MongoDB rather than on the server's disk.
 *
 * Why the database, when disk is cheaper
 * --------------------------------------
 * The API runs on Vercel. A serverless function has no disk that outlives the
 * request: a file written to /tmp is visible only to the instance that wrote
 * it, and is gone when that instance is recycled - usually within minutes. A
 * shop logo uploaded there showed once and then 404'd; a customer's CNIC scan
 * simply vanished. The database is the one store every instance shares and
 * that survives a redeploy, so that is where the bytes go.
 *
 * The cost is kept small on purpose: images are resized in the browser before
 * upload (see frontend utils/imageCompress.js), so a typical photo lands here
 * at 150-400 KB, and records hold only a short URL - never the payload - so a
 * customer list does not drag image bytes through every query.
 *
 * Files are served from GET /uploads/db/:id.ext with a year-long immutable
 * cache, since an id is never reused for different content.
 */

import mongoose from 'mongoose';

const storedFileSchema = new mongoose.Schema(
  {
    /** Folder the upload was filed under (customers, products, branding...). */
    folder: { type: String, default: 'misc', index: true },
    originalName: { type: String, default: '' },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const StoredFile = mongoose.model('StoredFile', storedFileSchema);
export default StoredFile;
