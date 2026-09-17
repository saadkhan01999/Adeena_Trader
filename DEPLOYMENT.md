# Deploying ADEENA TRADERS to Vercel

This repository is an npm workspaces monorepo holding two separate applications:

```
frontend/   React + Vite single-page app
backend/    Express + MongoDB API
```

They are **two Vercel projects**, both pointing at this same repository, each
with a different **Root Directory**. One project cannot serve both.

---

## The error you hit

```
sh: line 1: vite: command not found
Error: Command "vite build" exited with 127
```

`vite` is a dependency of `frontend`, not of `backend`. The backend project was
running `vite build`, which means its **Framework Preset** was set to *Vite* (or
its Build Command was overridden to `vite build`). Vercel installed the backend's
158 packages, none of which is Vite, and the shell could not find the command —
that is what exit code 127 means.

Nothing was wrong with your code. It was a project setting.

`backend/vercel.json` now pins `"framework": null` and a no-op build command, so
the preset cannot come back. The one thing `vercel.json` **cannot** set is the
Root Directory — you must set that in the dashboard, once, per the tables below.

---

## 1. Frontend project

**Settings → General**

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` *(leave as default)* |
| Output Directory | `dist` *(leave as default)* |

**Settings → Environment Variables** (Production)

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<your-backend-project>.vercel.app/api` |

Without `VITE_API_URL` the SPA calls `/api` on its own domain, where nothing is
listening. Note the trailing `/api` — the frontend appends paths directly to it.

> `frontend/vercel.json` adds a SPA rewrite so that opening
> `https://your-app.vercel.app/customers` directly, or refreshing on it, serves
> the app instead of a 404. Vercel does not add that automatically for Vite, so
> you would have hit this the first time anyone refreshed a page.

---

## 2. Backend project

**Settings → General**

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Framework Preset | **Other** |
| Build Command | leave empty — `backend/vercel.json` supplies it |
| Output Directory | leave empty — `backend/vercel.json` supplies it |

**Settings → Environment Variables** (Production)

| Key | Notes |
| --- | --- |
| `MONGODB_URI` | Atlas connection string. Percent-encode a password containing `@ : / ? # %`. |
| `JWT_SECRET` | 32+ characters. The app refuses to start in production on anything shorter. |
| `JWT_REFRESH_SECRET` | 32+ characters, **different** from `JWT_SECRET`. |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | `https://<your-frontend-project>.vercel.app` |
| `ALLOWED_ORIGINS` | Same URL. Comma-separated for several, **no trailing slash**. |
| `CRON_SECRET` | Any long random string. Required for the notification sweep. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`backend/.env.example` lists every variable the app reads, including the optional
ones.

---

## 3. MongoDB Atlas

Vercel functions do not have fixed IP addresses, so an access-list entry for your
home IP will not match them.

**Atlas → Network Access → ADD IP ADDRESS → Allow Access From Anywhere**
(`0.0.0.0/0`).

The database still requires the username and password in `MONGODB_URI`; this only
stops Atlas from rejecting the connection before authentication. If you need a
fixed IP instead, that is what Vercel's Secure Compute add-on is for.

---

## 4. Check it worked

```bash
curl https://<your-backend-project>.vercel.app/api/health
```

```json
{ "success": true, "data": { "status": "ok", "database": "connected", ... } }
```

`"status": "degraded"` with `"database": "disconnected"` means the function
deployed correctly but cannot reach MongoDB — check `MONGODB_URI` and the Atlas
access list, and read the function log under **Deployments → Logs**.

That distinction is the point of the health route: it answers without touching
the database, so it can tell you *which* of the two things is broken.

Then seed the first admin account, from your own machine, against the same
database:

```bash
cd backend
MONGODB_URI="<your atlas uri>" npm run seed
```

Sign in and change the password immediately.

---

## What changed in this repository

| File | Why |
| --- | --- |
| `backend/vercel.json` | Pins framework/build/output, routes every request to the function, schedules the sweep. |
| `backend/api/index.js` | Serverless entry point — the counterpart to `src/server.js`. |
| `backend/api/cron/notifications.js` | The notification sweep, driven by Vercel Cron instead of `setInterval`. |
| `backend/public/index.html` | A small landing page so the API root is not a 404. |
| `backend/src/config/env.js` | Detects serverless; throws instead of `process.exit`; picks the upload dir and cookie policy to match. |
| `backend/src/config/db.js` | Caches the connection across invocations instead of reconnecting per request. |
| `backend/src/app.js` | Upload-directory creation is no longer fatal; health check reports database state. |
| `backend/src/controllers/auth.controller.js` | Refresh cookie follows the resolved policy, so it survives a cross-site deployment. |
| `backend/.env.example` | Was missing, though `env.js` told you to copy it. |
| `frontend/vercel.json` | SPA rewrite, so a deep link or a refresh does not 404. |

`backend/src/server.js` is untouched and still the entry point for any host that
runs a real process (`npm start`, Render, Railway, a VPS).

---

## Two limitations to know about before you rely on this

### File uploads do not persist

A serverless filesystem is read-only apart from `/tmp`, and `/tmp` belongs to a
single function instance that Vercel discards whenever it feels like it. Uploads
now write to `/tmp/uploads` so they no longer crash, but:

**a CNIC scan, product photo, or signed agreement uploaded on Vercel will
disappear**, and a second instance cannot see what the first one wrote.

The two ways out:

1. **Move uploads to object storage** — Vercel Blob, Cloudinary, S3, UploadThing.
   This means replacing the `multer.diskStorage` engine in
   `backend/src/middleware/upload.js`; the rest of the upload code stores a URL
   and does not care where it points.
2. **Host the backend somewhere with a real disk** — Render, Railway, Fly, or a
   VPS. `npm start` already works there, no serverless entry point needed, and
   you would keep the `setInterval` sweep and long-lived connection pool too.

Given this app stores customer documents and agreements, option 2 is the smaller
change and the one I would pick. The frontend can stay on Vercel either way —
just point `VITE_API_URL` at wherever the API lives.

### The notification sweep runs once a day, not every 30 minutes

`setInterval` cannot survive in a function, so the sweep moved to Vercel Cron,
scheduled daily at 02:00 UTC in `backend/vercel.json`. **Vercel's Hobby plan only
permits one cron run per day.** On a Pro plan, change the schedule to hourly:

```json
"crons": [{ "path": "/api/cron/notifications", "schedule": "0 * * * *" }]
```

Set `CRON_SECRET`, or the endpoint refuses to run — it is a public URL that
writes across the whole database, so it will not default to open.
