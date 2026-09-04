# Kopano launch report (V2 verification)

**Date:** 2026-09-04  
**Classification:** CONTROLLED PILOT  
**Not:** PRODUCTION READY / live money

Verified against commit `b57a40e` plus the V2 hardening changes in this report.

## 1. Executive summary

The role-aware B2B UI (clients, wholesalers, agents, admin) is wired to existing backend APIs. V2 inspection found and fixed:

- `notif_token` / `external_reference` leaked to the payment client (webhook forgeable from the browser).
- PGlite (and any prepared-statement path) could not apply multi-statement migrations (`001`/`002`).
- Money math used float multiplication; totals now go through integer thebe helpers.
- Dead/fake analytics surface (`Analytics.jsx`) and unused layout shells removed.
- Production SUCCESS webhooks cannot mark paid when Orange Money confirmation is skipped.
- Order detail can resume Orange Money payment or cancel an unpaid reservation.

Real PostgreSQL concurrency, Docker runtime, and live Orange Money credentials remain **unproven in this environment**. That is why this is still a controlled pilot, not a production-money launch.

## 2. Architecture

- **Frontend:** Vite + React 18 + Tailwind, role-aware `AppShell`, JWT in `localStorage`, `/api` proxy.
- **Backend:** Express 5, JWT access + refresh, RBAC (`customer|agent|supplier|admin`).
- **Data:** PostgreSQL 15 in production compose; in-memory PGlite when `DATABASE_URL` is unset (dev/tests only).
- **Capacity:** `reserved_quantity` / `confirmed_quantity` / `released`, `FOR UPDATE` lock order group→order.
- **Payments:** Orange Money WebPay. Client never receives `notif_token`. Production requires Transaction Status API confirmation.

## 3. Backend capability matrix

| Capability | Endpoint | Auth | Role / ownership | Frontend | Status |
|---|---|---|---|---|---|
| Register | POST `/api/auth/register` | no | public | Auth | PASS |
| Login | POST `/api/auth/login` | no | public | Auth | PASS |
| Refresh | POST `/api/auth/refresh` | refresh JWT | — | client.js | PARTIAL (no rotation/store) |
| Me | GET `/api/auth/me` | JWT | self | AppShell | PASS |
| Supplier login | POST `/api/auth/supplier-login` | no | supplier | SupplierLogin | PASS |
| Groups list/detail | GET `/api/groups`, `/api/groups/:id` | no | catalogue | Buy, GroupDetail | PASS (public browse) |
| Create order | POST `/api/orders` | JWT | customer | Checkout | PASS |
| My orders / detail | GET `/api/orders/my`, `/api/orders/:id` | JWT | owner or admin | Orders, OrderDetail | PASS |
| Cancel | POST `/api/orders/:id/cancel` | JWT | owner | OrderDetail | PASS |
| Pay OM | POST `/api/payments/orange-money` | JWT | order owner | Checkout, OrderDetail | PASS |
| OM webhook | POST `/api/payments/webhook/orange-money` | notif_token | provider | — | PASS |
| Pay status | GET `/api/payments/status/:id` | JWT | owner/admin | Success | PASS |
| Expire stale | POST `/api/payments/expire-stale` | JWT | admin | none | PASS (ops) |
| Referrals | `/api/referrals/*` | mixed | owner / admin | Rewards | PASS |
| Supplier app | `/api/supplier-app/*` | JWT | supplier + `supplier_id` | Wholesaler workspace | PASS |
| Agents | `/api/agents/*` | JWT | agent (+ admin) | Agent workspace | PASS |
| Admin | `/api/admin/*` | JWT | admin | Admin workspace | PARTIAL (no orders UI) |
| Logout / password reset | — | — | — | — | NOT IMPLEMENTED |

## 4. Frontend capability matrix

| Role | Home | Screens |
|---|---|---|
| customer | `/app` | Home, Buy, Group, Checkout, Orders, Order detail (pay/cancel), Rewards, Profile |
| supplier (Wholesaler) | `/wholesaler` | Overview, Groups, Orders, Order detail, Catalogue, Deliveries, Analytics (real fill counts), Profile |
| agent | `/agent` | Home, Shops, Activate, Assist, Profile |
| admin | `/admin` | Overview, Clients, Groups, Revenue, Profile |

Route guards: `RequireAuth` + role wrappers. Backend remains the authority.

## 5. Security findings

### P0 — webhook token leak (fixed)

- **Finding:** Initiate/status responses returned `notifToken` and `externalReference`.
- **Evidence:** `POST /api/payments/orange-money` JSON; webhook lookup previously accepted `external_reference`.
- **Impact:** A customer could forge SUCCESS for their own order without the provider.
- **Fix:** Unguessable `notif_token`; never returned to clients; webhook lookup is `notif_token` only; production rejects skipped confirmation.
- **Test:** `does not leak notif_token…`; `production never marks paid when provider confirmation is skipped`.
- **Status:** Fixed.

### P0 — unpaid capacity consumed forever (fixed earlier)

- **Finding:** `current_quantity` incremented at checkout; failed payment did not release.
- **Fix:** reserved / confirmed / released with row locks.
- **Status:** Fixed (PGlite). Real Postgres concurrency still unproven here.

### P1 — multi-statement migrations failed on PGlite (fixed)

- **Finding:** `db.query(entireFile)` → `cannot insert multiple commands into a prepared statement`.
- **Fix:** `runSql` / `exec` + statement split; production fails hard on real migration errors.
- **Test:** `applies 001–003 on PGlite after schema.sql`.
- **Status:** Fixed.

### P1 — money float drift (fixed)

- **Finding:** `unitPrice * quantity` and fee bps in IEEE floats.
- **Fix:** integer thebe helpers (`mulQty`, `feeBps`, `addMoney`).
- **Status:** Fixed.

### HIGH — refresh tokens (open)

- No server-side store, rotation, or revocation. Stolen refresh JWT works until expiry (default 7d).
- **Status:** Known limitation. Acceptable for controlled pilot; not for production money.

### MEDIUM — JWT role snapshot

- Role is signed into the access token (1h). Demotion waits for expiry.
- **Status:** Documented.

### MEDIUM — public group catalogue

- `GET /api/groups` is unauthenticated by design (browse before login).
- **Status:** Intentional.

## 6. Authorization / isolation results

| Check | Result |
|---|---|
| Client A → Client B order | 404 |
| Customer → admin / supplier / agent | 403 |
| Wholesaler A → Wholesaler B orders/groups | 404 / empty scoped list |
| Agent A → Agent B shops | not listed |
| Agent → supplier analytics | 403 |
| Unauthenticated admin | 401 |
| Admin stats | 200 |

IDOR tests cover URL ids for orders (customer and supplier). Query/body supplier ids are ignored; ownership comes from JWT `supplierId` / `userId`.

## 7. Payment / financial integrity

| Gate | Result |
|---|---|
| State machine | pending_payment → payment_initiated → paid; fail/expire/cancel → released |
| Client cannot set paid | amount in body ignored; status not client-writable |
| Webhook auth | `notif_token` required; unknown token 401 |
| HMAC | optional; over raw bytes when present |
| Amount mismatch | 400 `AMOUNT_MISMATCH` |
| Duplicate webhook | 200 `already_completed`; quantities once |
| Production skip | 502 `PROVIDER_UNCONFIRMED`; order stays unpaid |
| Sandbox auto-complete | only when `PAYMENT_SANDBOX_AUTO_COMPLETE=true` **and** `NODE_ENV !== production` |

**CODE READY. PROVIDER ACTIVATION REQUIRED.**

## 8. PostgreSQL concurrency

Mandatory gate: **not proven in this sandbox.**

- `TEST_DATABASE_URL` unset.
- `apt-get install postgresql` → packages not in the image.
- `docker` → command not found.

PGlite tests serialize `getClient()`, so “exactly one succeeds” on last-unit is **not** a PostgreSQL `FOR UPDATE` proof.

The suite `postgresql reservation lifecycle` is present and skipped. Run on a host with Postgres:

```bash
cd backend
TEST_DATABASE_URL=postgres://kopano:change-me@127.0.0.1:5432/kopano npm run test:pg
```

## 9. UI/UX

- Kopano identity: forest teal, sand/clay, Plus Jakarta Sans, BWP formatting.
- Mobile bottom nav + desktop sidebar.
- Empty / loading / error states on role workspaces.
- Fake charts removed. Wholesaler analytics = live group fill counts.
- Order detail can resume payment or cancel unpaid orders.

## 10. Docker

Compose files inspected, **not executed** (`docker: command not found`).

Production overlay (`docker-compose.yml` + `docker-compose.prod.yml`):

- Postgres not published
- Frontend bind-mounts reset; nginx image built
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD` required via `:?`
- `PAYMENT_SANDBOX_AUTO_COMPLETE=false`

## 11. Dependency audit

This run: `npm audit --omit=dev` **timed out** (registry unreachable).

Last successful local result (previous pass, still the same lockfiles):

- Backend: 0 vulnerabilities
- Frontend: 2 moderate (react-router 6 SSR / open-redirect). Kopano is a SPA, not an SSR host; not force-upgraded to v7.

## 12. Test results (exact, this environment)

```
cd backend && npm test
# tests 66
# suites 9
# pass 66
# fail 0
# skipped 0
```

Node does not count the skipped PostgreSQL *suite* as a skipped test.

Frontend: `vite build` succeeded — **126 modules**.

| Scenario | Result |
|---|---|
| Order concurrency (PGlite serialized) | pass |
| Duplicate payment initiate | pass |
| Duplicate webhook | pass |
| Forged webhook | pass |
| Amount tampering | pass |
| Admin authorization | pass |
| Supplier isolation | pass |
| Agent isolation | pass |
| notif_token not leaked | pass |
| Production skipped confirmation | pass |
| Real PostgreSQL FOR UPDATE | **not run** |

## 13. Remaining gaps

**BLOCKER (live money)**

- Orange Money merchant + OAuth + public HTTPS `notif_url`
- Real PostgreSQL concurrency proof via `TEST_DATABASE_URL`
- Production Docker runtime on the deploy host
- Production secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD`, OM keys)

**HIGH**

- Refresh-token rotation / revocation
- Docker engine verification in CI

**MEDIUM**

- Admin orders / wholesaler directory screens (backend list exists for users/groups/revenue only)
- Agent “commission product” is referral ledger, not a separate payout engine
- Mascom / DPO labelled, not connected
- `users.supplier_id` has no FK (indexed only)

**LOW**

- No logout endpoint (client drops tokens)
- No password/PIN reset

## 14. Production readiness

**CONTROLLED PILOT**

Not production-ready for live money until provider credentials, HTTPS webhook, PostgreSQL concurrency, and production Docker are verified on the deploy host.

## 15. Commit

See git log after this report is committed. Files in this V2 pass:

- `backend/src/routes/payments.js` — hide tokens; notif_token-only webhook; production skip guard
- `backend/src/services/payments.js` — unconfigured initiate does not echo externalRef as notif_token
- `backend/src/lib/money.js`, `backend/src/routes/orders.js` — thebe arithmetic
- `backend/src/models/db.js`, `backend/src/index.js` — multi-statement migrations
- `backend/src/schema.sql`, `backend/src/migrations/003_integrity.sql`
- tests: isolation, webhook leak, production skip, money, migrations
- frontend: OrderDetail pay/cancel; dead Analytics/Layout/BottomNav/ProgressBar/SupplierLayout removed
