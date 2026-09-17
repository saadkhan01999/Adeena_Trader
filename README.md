# ADEENA TRADERS

**Business management for an installment retail shop** — sales, stock, customers,
collections, partners, investors, legal agreements and Zakat, in one system.

Built as a MERN application (MongoDB · Express · React · Node) for a real trading
business in Mardan, Pakistan. Everything in it reflects how that kind of shop
actually operates: 6 and 12 month interest-free plans, guarantors, WhatsApp
payment reminders, owner/partner profit splits, and Zakat calculated on the
Shariah nisab.

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [Quick start](#2-quick-start)
3. [Configuration](#3-configuration)
4. [How the business logic works](#4-how-the-business-logic-works)
5. [Roles and permissions](#5-roles-and-permissions)
6. [Screen by screen](#6-screen-by-screen)
7. [Documents and agreements](#7-documents-and-agreements)
8. [Zakat](#8-zakat)
9. [Notifications and reminders](#9-notifications-and-reminders)
10. [API reference](#10-api-reference)
11. [Data model](#11-data-model)
12. [Security](#12-security)
13. [Design system](#13-design-system)
14. [Project structure](#14-project-structure)
15. [Deployment](#15-deployment)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What it does

| Area | What you get |
|---|---|
| **Sales** | Cash and installment sales, 6 or 12 months, no interest. Live monthly figure as you type. Serial/IMEI capture. Printable invoice with the full payment schedule. |
| **Installments** | A collection worklist bucketed by urgency — overdue, due today, upcoming, later. Collect a payment or send a reminder without leaving the row. |
| **Payments** | Oldest-installment-first allocation, partial payments, printable receipt with the amount in words, and a one-tap thank-you message. |
| **Customers** | Identity, CNIC scans, guarantor, documents, running ledger, and account position at a glance. |
| **Products** | Catalogue with photo gallery, cash and installment pricing, live margin, reorder levels, serial tracking, and owner/partner allocation. |
| **Purchases** | Stock in from registered suppliers or the open market. Updates stock, cost and the supplier's payable in one transaction. |
| **Returns** | Full, partial and exchange. Puts stock back and adjusts the customer's balance. |
| **Partners** | Ownership percentage, capital, and their share of stock, sales, receivables and profit. Included in Zakat. |
| **Investors** | Capital, profit basis and payouts. **Never** included in Zakat. |
| **Agreements** | Installment, investment and partnership agreements, generated from templates you control, with witnesses, signing and scanned copies. |
| **Zakat** | 2.5% on the Shariah nisab, calculated from live stock, receivables and cash, for the owner and each partner. |
| **Reports** | Ten reports over real data — sales, collection, P&L, stock valuation, receivables ageing, expenses, Zakat, customers, products, suppliers. CSV export and print. |
| **Settings** | Business profile, branding, document wording, custom fields, operational defaults, notifications, reminders, security and data management. |

---

## 2. Quick start

### Requirements

- **Node.js 18 or newer** (tested on 24)
- **MongoDB** — a local instance or a free MongoDB Atlas cluster

### Install and run

```bash
npm install
```

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set `MONGODB_URI`, `JWT_SECRET` and `JWT_REFRESH_SECRET`.
Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the first administrator, the default categories and the document
templates:

```bash
npm run seed
```

Start both the API and the web app:

```bash
npm run dev
```

| | |
|---|---|
| Web app | http://localhost:8000 |
| API | http://localhost:5000/api |
| Health check | http://localhost:5000/api/health |

Sign in with the credentials `npm run seed` printed. You will be asked to change
the password immediately — the bootstrap password lives in a `.env` file and must
not stay in use.

> **No seeding?** Visiting the app on an empty database takes you to a two-step
> setup wizard instead, which creates the administrator and business profile
> through the UI.

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the API and the web app together |
| `npm run dev:backend` | API only, with auto-restart |
| `npm run dev:frontend` | Web app only |
| `npm run seed` | Creates the first administrator, categories and templates. Safe to re-run. |
| `npm run build` | Production build of the web app into `frontend/dist` |
| `npm start` | Runs the API in production mode |

---

## 3. Configuration

All server configuration lives in `backend/.env`. See
[`backend/.env.example`](backend/.env.example) for the annotated list.

| Variable | Default | Notes |
|---|---|---|
| `MONGODB_URI` | — | **Required.** Atlas or local connection string. |
| `JWT_SECRET` | — | **Required.** 32+ random characters. |
| `JWT_REFRESH_SECRET` | — | **Required.** Different from the above. |
| `PORT` | `5000` | API port. |
| `CLIENT_URL` | `http://localhost:8000` | Front-end origin, used for CORS. |
| `ALLOWED_ORIGINS` | derived | Comma-separated list for several origins. |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime. |
| `UPLOAD_DIR` | `backend/uploads` | Where photos and PDFs are written. |
| `MAX_FILE_UPLOAD_MB` | `8` | Per-file size limit. |
| `RATE_LIMIT_MAX` | `600` | Requests per window per IP. |
| `AUTH_RATE_LIMIT_MAX` | `20` | Failed sign-ins per window per IP. |
| `NOTIFICATION_SWEEP_MINUTES` | `30` | How often alerts are re-checked. `0` disables. |

Everything else — installment defaults, the Zakat rate and nisab, reminder
wording, agreement clauses, notification preferences — is configured in the app
under **Settings**, by an administrator, without touching a file.

---

## 4. How the business logic works

### Installments

Plans are **6 or 12 months only**, and carry **no interest**. The price is fixed
at the time of sale.

```
financed   = sale price − advance
monthly    = round(financed ÷ months)
```

The schedule is generated with the first payment one month after the sale date.
The **final installment absorbs the rounding remainder**, so the schedule always
sums to exactly the financed amount — a customer who adds up their payment card
gets the right total.

Due dates use a clamped month addition: 31 January plus one month is 28 (or 29)
February, not 3 March. A plain `setMonth` would silently shift a customer's due
date.

### Payment allocation

A payment is applied **oldest due date first**, across every open invoice for
that customer unless one is named. This clears the most overdue liability first,
which is both the fairest treatment and the simplest to explain at the counter.

Money received beyond what is owed is reported back rather than silently
absorbed, so the cashier can decide to refund it or hold it as credit.

### Installment status

Status is **computed**, never merely stored:

| Status | Meaning |
|---|---|
| `upcoming` | Not yet due |
| `due_today` | Falls due today |
| `partially_paid` | Some money received, balance outstanding |
| `late` | Past due but inside the configured grace period |
| `overdue` | Past due beyond the grace period |
| `paid` | Settled |

A background sweep re-derives these against today's date, so a row that quietly
became overdue overnight is classified correctly the next morning.

### Ownership splits

Stock, sales, collections and expenses each carry an ownership allocation:
`owner`, `partner` or `shared`. A `shared` record is split by the partner's
agreed percentage (or the default in Settings).

The **ownership lens** in the header — All Business / My Share / Partner Share —
re-slices every figure in the app. The two sides genuinely add up to the whole;
nothing is double-counted.

### Transactions

A sale touches six collections: Sale, Product, StockMovement, LedgerEntry,
Customer and (for an advance) Payment. These run inside a MongoDB transaction, so
a failure half way cannot leave stock decremented against a sale that was never
saved.

Transactions need a replica set. MongoDB Atlas always is one; a developer running
a standalone `mongod` is not, so the system detects that and falls back to
running the same work unguarded rather than refusing to start.

### Document numbering

Invoice, receipt and agreement numbers come from an atomic `$inc` inside
`findOneAndUpdate`. A read-modify-write would hand two simultaneous sales the
same invoice number, and the second would fail on the unique index.

---

## 5. Roles and permissions

Permissions are **derived from the role**, never stored per user. A role change
takes effect on that person's very next request, with no migration.

| Role | Can reach |
|---|---|
| **Administrator** | Everything, including settings, users, agreements, Zakat and data management |
| **Manager** | Sales, stock, purchases, suppliers, partners, investors, agreements, reports, Zakat |
| **Accountant** | Customers, installments, payments, expenses, returns, reports, Zakat, agreements |
| **Sales Staff** | Sales, customers, products, installments, payments, calculator |

### How accounts work

The administrator creates every other account from **Users & Roles**, choosing a
username and a first password to hand over directly.

There is **no self-service password reset** — by design. The administrator resets
a forgotten password from the same screen, which also clears any lockout and
signs out every device the user no longer controls.

The **sign-in screen adapts to the role** the person selects: the heading, the
hint and the accent colour all change. It is guidance only — the server decides
the real role from the account.

Two guard rails are enforced server-side: the last active administrator cannot be
disabled or demoted, and an administrator cannot change their own role or disable
their own account.

---

## 6. Screen by screen

### Dashboard
Today's money first (sales, collection, expenses, profit), then the current
position (receivable, overdue, stock, payables), then trends, then worklists —
due today, overdue, low stock — then recent activity. Ordered by what an owner
acts on, not by what is easiest to compute.

### Sales
A three-step flow — customer, items, payment — rather than one long form. The
monthly installment figure updates live from the shared financial engine, so the
number quoted to the customer is exactly what gets stored. Completing an
installment sale issues its agreement automatically.

### Installments
The collection worklist. Bucketed into overdue / due today / upcoming / later,
because the work in each is genuinely different. Collect a payment or send a
reminder from the row.

### Payments
Every receipt, with the allocation shown per installment, and a printable receipt
carrying the amount in words (crore/lakh/thousand, as a handwritten receipt
would).

### Customers
Profile, guarantor, CNIC scans, documents and running ledger in one dialog, with
call, WhatsApp and reminder actions.

### Products
Two views: a photo grid for showing a customer what is available, a table for
auditing stock and prices. Live margin while pricing. Stock moves only through
purchases, sales and returns — never by editing a number.

### Purchases
Registered supplier or open-market purchase. Raises stock, logs the movement,
updates the product cost and the supplier's payable in one transaction.

### Returns
Pre-populates the original invoice's items so the user deselects what is staying.
Puts stock back and adjusts the customer's balance.

### Partners / Investors
Partners hold an ownership percentage and **are** part of Zakat. Investors place
capital for a profit share and are **never** part of Zakat. Both screens state
this plainly.

### Agreements
Every legal document the business has issued, with its lifecycle — issued,
signed, active, cancelled — and the scanned signed copy attached.

### Reports
Ten reports, one contract, real data. CSV export runs server-side so the file
contains the complete result set, not the visible page.

### Settings
Grouped by who needs it: your profile and password (everyone), then business,
documents, custom fields, operations, communication and system (administrator).

---

## 7. Documents and agreements

### What the system prints

| Document | When |
|---|---|
| **Sales invoice** | Every sale. Installment sales include the full schedule with a blank "Received" column to tick off by hand. |
| **Payment receipt** | Every payment. A5 sized, with the amount in words. |
| **Installment sale agreement** | With every installment sale (11 clauses covering price, schedule, no-interest, ownership until final payment, default, early settlement, guarantor, warranty, dispute resolution). |
| **Investment agreement** | Issued from the Investors screen (Mudarabah basis — profit participation, loss sharing, books and inspection, withdrawal, Zakat responsibility). |
| **Partnership agreement** | Issued from the Partners screen (Shirkat-ul-Aqd — capital, profit ratio, loss in proportion to capital, management, drawings, retirement). |

### You own the wording

Under **Settings → Documents & agreements** an administrator can, for each
document type:

- Rewrite the title, subtitle, opening paragraph and footer
- Edit every clause, reorder them, switch any off
- **Add clauses of their own**
- Add a free-text "Your own wording" block printed after the clauses
- Restore the shipped defaults at any time

Placeholders in `{braces}` — `{customerName}`, `{monthlyInstallment}`,
`{firstDueDate}` and so on — are substituted with real values when a document is
issued. The editor shows every available placeholder as a click-to-copy chip.

### Agreements are frozen at signing

The rendered clause text is copied onto the agreement when it is issued. If the
wording is later rewritten, agreements already signed keep the words that were
actually agreed. An unsigned agreement can be regenerated against the current
template; a signed one cannot — it must be cancelled, with a reason, and replaced.

### Printing and PDF

The preview **is** the printed output — the same component renders both, and the
print stylesheet hides everything outside the document. "Print" and "Save as PDF"
both produce exactly what was previewed, with no second rendering path to drift
out of sync.

> The default agreement wording is a solid commercial starting point drafted for
> Pakistani retail installment trade. Review it with your own legal adviser and
> edit it in Settings — that is precisely why it lives in the database rather
> than in the code.

---

## 8. Zakat

### The rule this system enforces

> **Zakat applies to the OWNER and to PARTNERS only. Investors are never
> included.**

Investor capital is a liability of the business *towards* the investor, not the
owner's wealth, and each investor is responsible for the Zakat on their own
capital and profit share. Every Zakat query filters on this basis, and the
`/calculate` endpoint rejects any other ownership type outright.

### What is calculated

```
gross   = trade stock (at market value)
        + recoverable receivables
        + cash in hand
        + bank balance
        + other zakatable assets

net     = gross − supplier payables − other immediate liabilities

zakat   = net ≥ nisab  ?  net × 2.5%  :  0
```

Fixed assets used to run the shop — fittings, counters, the delivery bike — are
exempt and are not included.

### Nisab

The nisab weights are fixed by Shariah and never change; only the metal price
does:

| Basis | Weight | |
|---|---|---|
| Gold | 87.48 g | 7.5 tola |
| Silver | 612.36 g | 52.5 tola |

Where wealth is a **mixture** of asset types — which a trading business always is
— the **lower silver threshold** applies. That is the system's default.

The administrator enters today's local rate per gram in **Zakat → Settings** and
the rupee threshold is derived from it. The figure updates live as the rate is
typed, and the source of the rate can be recorded as an audit note. A manual
rupee threshold is also supported, for shops that follow a local announcement.

### Automatic calculation

Opening the Zakat calculator reads the live position straight from the business:

- **Trade stock** — every non-archived product, valued at its cash selling price
  (the current market value, which is what trade goods are assessed at), sliced
  to the owner's or the selected partner's share
- **Receivables** — outstanding installment balances, with anything more than a
  year overdue flagged separately as doubtful
- **Supplier payables** — deducted, split by ownership

Only cash in hand, the bank balance and any other assets or liabilities are
typed, because those are the only figures the system cannot observe. **Everything
recalculates as you type**, and the server re-reads the live figures when the
calculation is saved, so a client cannot inflate the zakatable base.

### Hawl

Zakat falls due once a full lunar year (≈354 days) has passed with wealth above
the nisab. Set the hawl start date in Settings and the system shows the progress
and the due date, and raises a reminder as it approaches.

### Records and payment

Every calculation is saved with its full working — each asset class, the
deductions, the threshold and the basis used — and Zakat paid can be recorded
against it, in full or in parts.

---

## 9. Notifications and reminders

### Notifications

Alerts are **derived from live data**, not written by hand. A sweep runs every 30
minutes (configurable) and raises one notification per real condition:

- Installments due today, coming up, or overdue (aggregated per customer, so
  someone four months behind produces one urgent alert, not four)
- Low stock and out of stock, against each product's own reorder level
- Supplier payables
- Investor profit earned but not yet paid out
- Zakat, as the hawl completes

Each alert carries a deterministic de-duplication key, so re-running the sweep is
a no-op for the day and the unread badge stays honest. "Check now" in the bell
menu runs the sweep on demand.

### Customer reminders

Reminder messages are **composed server-side from the administrator's template**,
so the wording is identical whoever presses the button.

| Template | Sent |
|---|---|
| Upcoming | A few days before an installment falls due |
| Due today | On the morning it is due |
| Overdue | Once it has passed its due date, with the day count |
| Payment received | Offered after a payment is recorded |

Messages open in **WhatsApp** with the text already filled in — your staff press
send. The system never claims a message was delivered when no gateway exists.
Bulk sends are staggered about one per second so the browser's popup blocker does
not swallow them.

Every generated message is logged with who sent it and when, and a configurable
cooldown stops the same installment being chased three times in one morning by
three different people.

Templates support `{customerName}`, `{invoiceNumber}`, `{installmentNumber}`,
`{amount}`, `{balance}`, `{dueDate}`, `{daysOverdue}`, `{receiptNumber}`,
`{businessName}` and `{businessPhone}`. Clearing a template restores the built-in
wording.

---

## 10. API reference

Base URL: `/api`

All responses share one shape:

```jsonc
// Success
{ "success": true, "message": "…", "data": { … } }

// Failure
{ "success": false, "message": "…", "code": "…", "errors": [ { "field": "…", "message": "…" } ] }
```

Authenticate with `Authorization: Bearer <accessToken>`. The refresh token is an
httpOnly cookie the browser sends automatically.

### Authentication — `/api/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/login` | public | Sign in with `identifier` (username **or** email) and `password` |
| POST | `/refresh` | cookie | Exchange the refresh cookie for a new access token (rotates the refresh token) |
| POST | `/logout` | public | Clear the cookie and revoke the session server-side |
| GET | `/setup-status` | public | Whether setup is required, plus the roles that have accounts |
| POST | `/setup` | public¹ | Create the first administrator and business profile |
| GET | `/me` | any | Current user profile and permissions |
| PUT | `/change-password` | any | Change own password (revokes other sessions, keeps this one) |
| PUT | `/profile` | any | Update own name, phone, photo, designation |
| POST | `/profile/photo` | any | Upload own avatar |

¹ Refused once any user exists.

### Sales — `/api/sales`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | sales | List with search, filters, pagination and summary totals |
| GET | `/:id` | sales | One sale, with the business profile and any agreement |
| POST | `/` | sales | Create a sale; issues the installment agreement automatically |
| POST | `/:id/agreement` | agreements | Issue (or fetch) the installment agreement |
| GET | `/overdue/list` | installments | The installment worklist, bucketed by urgency |

**Query:** `page`, `limit`, `search`, `saleType`, `status`, `ownership`, `customerId`, `startDate`, `endDate`, `sortBy`, `sortOrder`

### Payments — `/api/payments`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | payments | List with filters and pagination |
| GET | `/:id` | payments | One payment with its allocations and the business profile |
| POST | `/` | payments | Record a payment; allocates oldest-first and returns a thank-you message |

### Customers — `/api/customers`

| Method | Path | Permission |
|---|---|---|
| GET | `/` · `/:id` · `/:id/ledger` | customers |
| POST | `/` | customers |
| PUT | `/:id` | customers |
| DELETE | `/:id` | customers (deactivates when sales exist) |
| POST | `/:id/photo?field=photo\|cnicFrontPhoto\|cnicBackPhoto` | customers |
| POST | `/:id/documents` | customers |
| DELETE | `/:id/documents/:index` | customers |

### Products — `/api/products`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List with search, category, status and stock-level filters |
| GET | `/low-stock` | Products at or below their own reorder level, plus those out of stock |
| GET | `/:id` | One product |
| POST | `/` · PUT `/:id` · DELETE `/:id` | Create, update, archive/delete |
| POST | `/:id/images` | Upload up to 10 photos |
| PUT | `/:id/images/:index/primary` | Set the cover image |
| DELETE | `/:id/images/:index` | Remove a photo and delete the file |

### Categories · Suppliers · Expenses

Standard CRUD at `/api/categories`, `/api/suppliers`, `/api/expenses`
(`GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`).

### Purchases — `/api/purchases`

| Method | Path | Description |
|---|---|---|
| GET | `/` · `/:id` | List and detail |
| POST | `/` | Record a purchase: raises stock, logs the movement, updates the supplier payable |

### Returns — `/api/returns`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List |
| POST | `/` | Record a return or exchange |

### Partners — `/api/partners`

`GET /`, `GET /:id`, `GET /:id/dashboard`, `POST /`, `PUT /:id`, `DELETE /:id`

### Investors — `/api/investors`

| Method | Path | Description |
|---|---|---|
| GET | `/` · `/:id` · `/dashboard` | List, detail, aggregate position |
| POST | `/` · PUT `/:id` · DELETE `/:id` | Manage investors |
| POST | `/:id/investments` | Record an additional investment |
| POST | `/:id/payouts` | Record a profit payout |

### Agreements — `/api/agreements`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List with type, status, party, search and date filters, plus summary |
| GET | `/:id` | Agreement with the business profile, ready to print |
| POST | `/` | Issue one. Body: `{ type, saleId \| investorId \| partnerId }` |
| PUT | `/:id` | Amend an unsigned agreement |
| POST | `/:id/sign` | Record execution — freezes the wording |
| POST | `/:id/regenerate` | Re-render an unsigned agreement against the current template |
| POST | `/:id/attachments` | Attach the scanned signed copy (images or PDF) |
| DELETE | `/:id/attachments/:index` | Detach and delete the file |
| DELETE | `/:id` | Cancel, with a required reason |

### Zakat — `/api/zakat`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/settings` | zakat | Settings, the Shariah reference weights, and hawl progress |
| PUT | `/settings` | admin | Update rate, nisab basis, metal rates, eligible assets |
| GET | `/nisab-preview` | zakat | Live nisab for a candidate metal rate, without saving |
| GET | `/assets` | zakat | **Live zakatable position** from stock, receivables and payables |
| POST | `/calculate` | zakat | Calculate and record. Only `owner` or `partner` accepted |
| GET | `/history` | zakat | Past calculations with totals |
| GET | `/:id` | zakat | One calculation with its full working |
| PUT | `/:id/payment` | zakat | Record Zakat paid |
| DELETE | `/:id` | admin | Delete a calculation (blocked once anything is paid) |

### Documents & custom fields — `/api`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/templates` | any | All document templates |
| GET | `/templates/:type` | any | One template |
| GET | `/templates/:type/default` | admin | The shipped default, for comparison |
| PUT | `/templates/:type` | admin | Save your wording and clause order |
| POST | `/templates/:type/reset` | admin | Restore the shipped defaults |
| GET | `/custom-fields` | any | Custom fields, flat and grouped by module |
| POST | `/custom-fields` | admin | Add a field to a module's form |
| PUT | `/custom-fields/:id` | admin | Update (the storage key is immutable) |
| PUT | `/custom-fields/reorder` | admin | Persist a drag-and-drop reorder |
| DELETE | `/custom-fields/:id?hard=true` | admin | Hide (default) or delete permanently |

### Reports — `/api/reports`

| Method | Path | Description |
|---|---|---|
| GET | `/` | The report catalogue |
| GET | `/:type` | Build a report |
| GET | `/:type/export` | Stream the complete result set as CSV |

**Types:** `sales`, `collection`, `profit`, `stock`, `receivables`, `expenses`,
`zakat`, `customers`, `products`, `suppliers`

**Query:** `startDate`, `endDate`, `ownership`

Every report returns `{ meta, summary, series, breakdown, rows }`.

### Reminders — `/api`

| Method | Path | Description |
|---|---|---|
| GET | `/reminders/generate?scope=overdue\|due_today\|upcoming\|all` | Preview messages without logging |
| GET | `/reminders/installment/:saleId/:installmentNumber` | One installment's message |
| GET | `/reminders/customer/:customerId` | One consolidated message for all of a customer's arrears |
| POST | `/reminders/log` | Record that reminders were sent |
| GET | `/reminders` | Reminder history with filters |

### Notifications — `/api/notifications`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List, with the unread count and severity breakdown |
| POST | `/refresh` | Re-scan the business for alert conditions now |
| PUT | `/:id/read` · `/read-all` | Mark read |
| DELETE | `/:id` · `/clear-read` | Dismiss |

### Uploads — `/api/uploads`

| Method | Path | Description |
|---|---|---|
| POST | `/:folder` | Upload one image or PDF (JPG, JPEG, PNG, WEBP, PDF) |
| POST | `/:folder/multiple` | Up to 10 files |
| DELETE | `/?url=…` | Delete a file |
| GET | `/stats` | Disk usage (admin) |

Folders: `customers`, `products`, `agreements`, `expenses`, `business`, `users`, `misc`.
Files are served from `/uploads/<folder>/<year-month>/<random>.<ext>`.

### Users — `/api/users`

| Method | Path | Description |
|---|---|---|
| GET | `/roles` | Roles with labels, descriptions and the modules each unlocks |
| GET | `/` · `/:id` | List and detail |
| POST | `/` | Create a staff account |
| PUT | `/:id` | Update (role and status guarded) |
| PUT | `/:id/reset-password` | Reset a password and clear any lockout |
| POST | `/:id/photo` | Upload a photo |
| DELETE | `/:id` | Disable the account |

### Settings, dashboard, search — `/api`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/dashboard?ownership=&days=` | dashboard | Everything the home screen needs |
| GET | `/search?q=` | any | Global search across permitted entities |
| GET | `/settings` | any | Readable by all; reduced view for non-admins |
| PUT | `/settings` | admin | Partial update; nested groups are merged |
| GET | `/business/profile` | any | Business profile |
| PUT | `/business/profile` | admin/manager | Update |
| POST | `/business/branding?field=logo\|stamp\|signature` | admin/manager | Upload branding |
| DELETE | `/business/branding?field=` | admin/manager | Remove |
| GET | `/audit-logs` | admin | The audit trail |

### Data management — `/api/data` (admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Record counts per collection and database size |
| GET | `/backup?includeLogs=` | Download a full JSON backup (passwords excluded) |
| POST | `/restore` | Restore. `{ backup, mode: 'merge' \| 'replace', confirm }` |
| POST | `/repair` | Recompute cached balances and installment statuses |
| DELETE | `/transactions` | Clear transactions, keep master data. Requires `confirm: "CLEAR TRANSACTIONS"` |
| DELETE | `/all` | Erase everything. Requires `confirm: "DELETE EVERYTHING"` **and** the admin's password |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Service status, version and uptime. No authentication. |

---

## 11. Data model

| Collection | Holds |
|---|---|
| `users` | Credentials, role, lockout state, hashed refresh tokens |
| `businessprofiles` | Business identity, branding, document numbering (singleton) |
| `settings` | Every app-wide preference (singleton) |
| `categories` | Product categories with icons |
| `products` | Catalogue, pricing, stock, serials, ownership, photos |
| `customers` | Identity, guarantor, documents, running totals |
| `suppliers` | Contact and payable balance |
| `partners` | Ownership share, capital, running totals |
| `investors` | Capital, profit basis, payout totals |
| `investments` · `investorpayouts` | Individual investments and payouts |
| `sales` | Invoices with embedded installment schedules |
| `payments` | Receipts with per-installment allocations |
| `purchases` | Stock in, with source and payable |
| `returns` | Returns and exchanges |
| `expenses` | Running costs, with ownership allocation |
| `agreements` | Issued agreements, with frozen clause text |
| `documenttemplates` | Editable wording per document type (singleton per type) |
| `customfields` | Admin-defined extra fields per module |
| `zakatsettings` · `zakatcalculations` | Nisab configuration and recorded calculations |
| `ledgerentries` | Double-sided ledger per customer/supplier |
| `stockmovements` | Audit trail of every stock change |
| `reminders` | Every reminder generated, with who sent it |
| `notifications` | Derived alerts, de-duplicated per day |
| `auditlogs` | Who changed what, with before and after |

**Snapshots over joins.** Sales store the customer's name, phone and CNIC;
agreements store the rendered clause text. A legal document must not change
because a customer later updated their phone number.

---

## 12. Security

| Measure | How |
|---|---|
| **Password storage** | bcrypt, cost factor 12. Never returned by any query — the field is `select: false`. |
| **Session tokens** | Short-lived access token (15 min) in memory/localStorage; long-lived refresh token in an httpOnly cookie JavaScript cannot read. |
| **Refresh rotation** | Single-use. Replaying a rotated token revokes every session for that user. |
| **Token storage** | Refresh tokens are stored **hashed**, so a database dump cannot be used to mint access tokens. |
| **Per-request verification** | Every request re-checks the account exists, is active, and has not changed its password since the token was issued. A JWT is a snapshot; the lookup is what makes deactivation immediate. |
| **Brute force** | Sign-in has its own tighter rate limit, and accounts lock temporarily after a configurable number of failures. |
| **Enumeration** | "Account not found" and "wrong password" return the identical message. |
| **NoSQL injection** | `express-mongo-sanitize` strips `$` and `.` operators after parsing, before any handler can build a query. |
| **Regex injection** | Every user-supplied search term is escaped before becoming part of a regular expression. |
| **CSV injection** | Cells starting `=`, `+`, `-` or `@` are quote-prefixed, so Excel cannot evaluate a customer's name as a formula. |
| **Path traversal** | Upload paths are resolved and checked to stay inside the upload directory; filenames are random, never the original. |
| **Upload validation** | MIME type and size checked before anything is written. `X-Content-Type-Options: nosniff` on every served file. |
| **Headers & CORS** | Helmet, with an explicit origin allow-list. |
| **Destructive actions** | Typed confirmation phrases; erasing everything additionally requires the administrator's password. |
| **Audit trail** | Every create, update and delete is logged with the user, IP, and before/after state. |
| **Backups** | Password hashes are excluded — a backup file travels on laptops and phones and must not carry credentials. |

`npm audit` reports **zero vulnerabilities** across both workspaces.

---

## 13. Design system

**Navy + Gold.** Navy carries authority and reads as financial software; gold
marks value and action.

### Cornerstones

- **Radius is capped.** The whole Tailwind radius scale tops out at 10px, with
  cards and panels at 8–9px. Overriding the scale rather than editing classNames
  means the rule holds everywhere, including in code written later.
- **Fluid type.** Headings and metrics use `clamp()`, so text scales smoothly
  between a 380px phone and a 1920px counter display without breakpoint-specific
  sizes.
- **One motion vocabulary.** Every interactive primitive carries the same 200ms
  `ease-out-expo` and a `scale(0.97)` press. The press feedback is what makes a
  tap feel acknowledged on a touch device.
- **Reduced motion honoured.** `prefers-reduced-motion` disables animation.

### Responsive strategy

| Breakpoint | Width | What changes |
|---|---|---|
| `xs` | 380px | Smallest supported phone |
| `sm` | 640px | Modals become centred panels rather than bottom sheets |
| `md` | 768px | Tables replace the card view |
| `lg` | 1024px | Sidebar becomes a permanent, collapsible column |
| `xl` | 1280px | KPI tiles go to four across |
| `2xl` / `3xl` | 1536 / 1920px | Content is capped so lines stay readable |

Tables become **cards** below `md` — nine columns cannot be made readable at
380px by shrinking them. Inputs are forced to 16px on phones, because anything
smaller makes iOS Safari zoom the page on focus.

### Accessibility

Visible focus rings throughout; modals trap focus, restore it on close and lock
background scroll; icon-only buttons all carry accessible names; status is never
conveyed by colour alone.

---

## 14. Project structure

```
adeena-traders/
├── backend/
│   ├── src/
│   │   ├── config/          env validation, database connection
│   │   ├── constants/       roles, permissions, enums, defaults
│   │   ├── controllers/     one per module (18)
│   │   ├── middleware/      auth, RBAC, validation, uploads, errors, audit
│   │   ├── models/          Mongoose schemas (24)
│   │   ├── routes/          Express routers (18)
│   │   ├── services/        financial, notification, reminder, agreement,
│   │   │                    template, auth
│   │   ├── utils/           financial engine, errors, responses, seed
│   │   ├── validators/      Zod schemas
│   │   ├── app.js           middleware pipeline and route mounting
│   │   └── server.js        startup, jobs, graceful shutdown
│   └── uploads/             photos and PDFs, bucketed by module and month
│
└── frontend/
    └── src/
        ├── components/
        │   ├── common/      the UI primitives (Button, Form, Modal, DataTable,
        │   │                StatCard, ChartCard, FileUpload, Tabs, …)
        │   ├── documents/   printable invoice, receipt and agreements
        │   ├── layout/      sidebar, header, command palette, notifications
        │   └── modals/      calculator, reminders, document preview, password
        ├── constants/       nav, roles, enums, chart palette, fallbacks
        ├── context/         Zustand stores (auth, UI, settings, toasts)
        ├── features/        one folder per screen (18)
        ├── hooks/           debounce, media query, table state, async, …
        ├── pages/           sign-in, first-run setup
        ├── routes/          route guard
        ├── services/        API client and entity services
        └── utils/           formatting, export/print, financial engine (mirror)
```

### The financial engine is mirrored

`backend/src/utils/financialEngine.js` and
`frontend/src/utils/financialEngine.js` are the same file. Keeping the formulas
identical on both sides means the installment breakdown a salesman previews on
screen is arithmetically the same one the server stores — no "the screen said
17,500 but the invoice says 17,499".

**If you change a formula in one, change it in the other.**

---

## 15. Deployment

### Build

```bash
npm run build
```

Produces `frontend/dist`. Serve it from any static host or nginx.

The bundle is split so a code change does not invalidate cached vendor chunks:

| Chunk | Gzipped |
|---|---|
| React | 46 kB |
| Motion | 38 kB |
| Core (axios, zustand, zod) | 21 kB |
| Router | 14 kB |
| Icons | 10 kB |
| Charts *(lazy — dashboard and reports only)* | 85 kB |
| App | 43 kB |

### Production checklist

- [ ] `NODE_ENV=production`
- [ ] Fresh `JWT_SECRET` and `JWT_REFRESH_SECRET`, 32+ characters each
- [ ] `CLIENT_URL` / `ALLOWED_ORIGINS` set to your real domain
- [ ] HTTPS everywhere — the refresh cookie is `secure` in production
- [ ] `UPLOAD_DIR` on persistent storage (not a container's ephemeral filesystem)
- [ ] MongoDB Atlas IP allow-list configured
- [ ] Automated database backups enabled
- [ ] `backend/.env` excluded from version control (it already is)
- [ ] Bootstrap administrator password changed

### Serving the app and API together

Point nginx at `frontend/dist`, and proxy `/api` and `/uploads` to the Node
process. Keeping them same-origin means the refresh cookie stays first-party and
CORS never enters the picture.

---

## 16. Troubleshooting

**`MongoDB connection failed`**
Check `MONGODB_URI`. On Atlas, confirm your IP is allow-listed and the password
is URL-encoded if it contains special characters.

**`Missing required environment variable`**
`backend/.env` does not exist or is missing `MONGODB_URI`, `JWT_SECRET` or
`JWT_REFRESH_SECRET`. Copy `backend/.env.example` and fill it in.

**Everyone is signed out unexpectedly**
`JWT_SECRET` or `JWT_REFRESH_SECRET` changed. Every existing token is invalidated
by design.

**"This origin is not permitted to call the API"**
Add the front-end origin to `ALLOWED_ORIGINS` in `backend/.env`.

**Uploads return 404 after a redeploy**
`UPLOAD_DIR` is on ephemeral storage. Point it at a persistent volume.

**A balance looks wrong**
Run **Settings → Data Management → Repair**. It recomputes customer balances and
installment statuses from the underlying transactions, and changes no
transactions.

**Transactions are unavailable**
You are running a standalone `mongod`. The system detects this and continues
without transactions. Use a replica set or Atlas in production.

**Zakat says "Nisab not set"**
Enter today's silver rate per gram in **Zakat → Settings**. The threshold is
612.36 g × that rate.

**Reminders open only one or two WhatsApp tabs**
The browser's popup blocker. Allow popups for the app's origin.

---

## Licence

MIT © ADEENA TRADERS
