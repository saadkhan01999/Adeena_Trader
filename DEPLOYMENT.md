# Deploying ADEENA TRADERS

This repository is an npm workspaces monorepo holding two applications that are
deployed separately:

| Part | Folder | Live URL |
| --- | --- | --- |
| React + Vite SPA | `frontend/` | https://adeena-trader-frontend.vercel.app |
| Express + MongoDB API | `backend/` | https://adeenatrader-production.up.railway.app |

The repository is now wired for exactly that pair, so a fresh deploy of either
side works without anything being configured by hand.

---

## Why login returned 404

`VITE_API_URL` was not set on the Vercel build, so the SPA fell back to its
development default of `/api` and posted the login to its **own** origin:

```
https://adeena-trader-frontend.vercel.app/api/auth/login   -> 404
```

Nothing is listening there — the API is on Railway. The browser reported
`Request failed with status code 404`, which is what Vercel returns for a path
it does not recognise.

It could not have come from the API: an unknown `/api/...` path on the backend
sits behind the auth middleware and answers **401**, never 404. That is
confirmed by a test in this repository.

Three things now prevent it recurring:

1. **`frontend/.env.production` is committed** with the Railway URL, so a build
   knows where the API is with nothing set in the Vercel dashboard.
2. **The URL is normalised** in `frontend/src/constants/index.js`, so
   `https://host`, `https://host/`, `https://host/api` and `https://host/api/`
   all resolve to the same working base. Three of those four used to 404.
3. **The API logs refused origins** with the allow-list it checked against, so
   the next mismatch is one glance at the Railway logs instead of guesswork.

---

## 1. Frontend on Vercel

**Settings → General**

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build / Output Command | leave default — `frontend/vercel.json` supplies them |

**No environment variables are required.** The API URL comes from
`frontend/.env.production`.

To point a build somewhere else (a fork, a staging API), set `VITE_API_URL` in
**Settings → Environment Variables** — a real environment variable overrides the
committed file. The trailing `/api` is optional; it is added if missing.

> `VITE_API_URL` is compiled into the JavaScript bundle at build time, so
> changing it needs a **redeploy**, not a restart. It is also public — anyone can
> read it in the bundle — which is why an API URL belongs there and a secret
> never does.

> `frontend/vercel.json` adds the SPA rewrite Vercel does not add for Vite.
> Without it, opening `/setup` or `/customers` directly — or refreshing on them —
> returns 404.

---

## 2. Backend on Railway

Railway builds from the repository root, where `npm start` already delegates to
the backend workspace. No start command override is needed.

**Variables** — the first three are mandatory; the service refuses to boot
without them:

| Key | Notes |
| --- | --- |
| `MONGODB_URI` | Atlas connection string. Percent-encode a password containing `@ : / ? # %`. |
| `JWT_SECRET` | 32+ characters. |
| `JWT_REFRESH_SECRET` | 32+ characters, **different** from `JWT_SECRET`. |
| `NODE_ENV` | `production` |
| `UPLOAD_DIR` | `/data/uploads` — see the volume note below. |
| `CLIENT_URL` | Optional. Defaults to the Vercel URL above. |
| `ALLOWED_ORIGINS` | Optional. Defaults to the Vercel URL above. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`backend/.env.example` documents every variable the app reads.

### Attach a volume, or uploads vanish

Railway's container filesystem is rebuilt on every deploy. Without a volume,
**every CNIC scan, product photo and signed agreement is deleted the next time
you push**.

**Railway → your service → Variables → Volumes → mount at `/data`**, then set
`UPLOAD_DIR=/data/uploads`.

Files written there survive deploys and restarts.

### CORS and the refresh cookie

Both are handled automatically for this pair of URLs:

- The Vercel origin is on the allow-list by default.
- The refresh cookie is issued `SameSite=None; Secure` because the SPA and the
  API are on different hosts. This is decided per request by comparing the
  request's `Origin` against the host it arrived on — **not** from `NODE_ENV`,
  so forgetting that variable cannot silently break sign-in.

If you later serve both from one domain, the same logic switches back to
`SameSite=Strict` on its own. `COOKIE_SAME_SITE` forces a specific value if you
ever need to.

For preview deployments, whose hostname changes every push, add a pattern:

```
ALLOWED_ORIGINS=https://adeena-trader-frontend.vercel.app,https://adeena-trader-frontend-*.vercel.app
```

`*` does not match a dot, so the pattern stays narrow. Keep the prefix specific —
an entry as broad as `https://*.vercel.app` would let anyone's Vercel project
make credentialed calls to your API.

---

## 3. First run — creating the admin

There is **no need to run a seed script**. Open the site:

https://adeena-trader-frontend.vercel.app

When the database has no users, the login page redirects to `/setup`, where you
create the administrator and the business profile in the browser. The endpoint
refuses to run once any user exists, so it cannot be used twice.

If you prefer the scripted route, `cd backend && MONGODB_URI="..." npm run seed`
creates the default admin from `backend/.env.example`. Change that password
immediately.

---

## 4. Check it worked

```bash
curl https://adeenatrader-production.up.railway.app/api/health
```

```json
{ "success": true, "data": { "status": "ok", "database": "connected", ... } }
```

| What you see | What it means |
| --- | --- |
| `"status": "ok"` | API is up and talking to MongoDB. |
| `"status": "degraded"`, `"database": "disconnected"` | API is running but cannot reach MongoDB — check `MONGODB_URI` and the Atlas access list. |
| No response at all | The service is not running — check the Railway deploy logs. |

The health route deliberately does not touch the database, so it can tell you
*which* of those two things is wrong.

**MongoDB Atlas:** Railway does not give your service a fixed outbound IP, so set
**Atlas → Network Access** to allow `0.0.0.0/0`. The username and password in
`MONGODB_URI` still guard the database; this only stops Atlas refusing the
connection before authentication.

If login still fails, open the browser devtools Network tab and look at the
request URL. It should read
`https://adeenatrader-production.up.railway.app/api/auth/login`. If it points at
the Vercel domain instead, the frontend was built before this change — redeploy
it.

---

## Moving to different URLs

Both defaults live in one place each:

- Frontend → `VITE_API_URL` in `frontend/.env.production`
- Backend → `PRODUCTION_CLIENT_URL` in `backend/src/config/env.js`

Either can be overridden with a dashboard environment variable
(`VITE_API_URL`, `ALLOWED_ORIGINS` / `CLIENT_URL`) without touching the code.

---

## What changed in this repository

| File | Why |
| --- | --- |
| `frontend/.env.production` | Committed API URL, so a build needs no dashboard config. |
| `frontend/src/constants/index.js` | Normalises the API base URL — the 404's direct cause. |
| `frontend/vercel.json` | SPA rewrite, so `/setup` and deep links do not 404. |
| `backend/src/utils/cookiePolicy.js` | Decides SameSite per request, so the cross-domain refresh cookie works. |
| `backend/src/config/env.js` | Defaults to the live frontend, trims/dedupes origins, supports preview-URL patterns. |
| `backend/src/app.js` | Wildcard-aware CORS; logs refused origins with the allow-list. |
| `backend/src/controllers/auth.controller.js` | Cookie options now derived from the request. |

### Also still present: running the backend on Vercel

`backend/vercel.json` and `backend/api/` remain from the earlier Vercel attempt
and still work, should you ever want it. Two caveats apply there and not on
Railway: uploads cannot persist (`/tmp` is per-instance and discarded), and the
notification sweep runs on Vercel Cron — once a day on the Hobby plan — instead
of every 30 minutes. Railway has neither limitation, which is why the backend
lives there.

`backend/src/server.js` is the entry point on Railway and anywhere else that runs
a real process; `backend/api/index.js` is used only by Vercel.
