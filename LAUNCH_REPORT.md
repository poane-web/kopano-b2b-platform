# Kopano launch report

**Date:** 2026-08-26  
**Classification:** READY FOR CONTROLLED PILOT  
**Not:** READY FOR PRODUCTION (live money)

## 1. Phases completed

| Phase | Status |
|-------|--------|
| 1 Architecture, DB, wiring | Complete |
| 2 Auth, RBAC, API security | Complete |
| 3 Groups, orders, concurrency, fees | Complete |
| 4 Payments, idempotency, webhooks | Complete (provider activation external) |
| 5 Supplier / agent / CSV / referrals | Complete |
| 6 Frontend/API alignment, token lifecycle, payment UX | Complete |
| 7 PWA stale financial cache | Complete (API network-only) |
| 8 Production Docker / env | Complete (compose files; Docker engine not in this sandbox) |
| 9 Integration tests | Complete on PGlite — 55 passed; real PostgreSQL suite present, skipped here |
| 10 Security review | Complete |
| 11 Reservation / payment lifecycle (P1) | Complete |

## 2. Important files

- `backend/src/services/reservations.js` — reserved / confirmed / released capacity
- `backend/src/routes/{orders,payments,groups}.js`
- `backend/src/lib/omWebhook.js` — raw-body parse + optional HMAC; notif_token auth
- `backend/src/schema.sql`, `backend/src/migrations/002_reservations.sql`
- `backend/test/reservations.integration.test.js`
- `backend/test/webhook.integration.test.js`
- `backend/test/postgres.integration.test.js` (requires `TEST_DATABASE_URL`)
- `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.dev.yml`

## 3. Vulnerabilities / logic bugs (before → after)

| Issue | Before | After |
|-------|--------|--------|
| Unpaid order permanently consumed group quantity | `current_quantity` incremented at checkout; fail left it filled | `reserved_quantity` held until pay/fail/expire/cancel; fail/expire/cancel releases |
| Webhook HMAC over `JSON.stringify(req.body)` | Could diverge from wire bytes | Raw request bytes captured; HMAC only if header/`OM_REQUIRE_HMAC` |
| Orange callback auth guessed as HMAC | Incorrect vs WebPay spec | `notif_token` lookup + Transaction Status API when credentials exist |
| Tracked `.env.txt` | Placeholder secrets in git | Removed from git; ignored |

## 4. Tests (exact, this environment)

```
cd backend && NODE_ENV=test npm test
# tests 55
# suites 7
# pass 55
# fail 0
# skipped 0
```

PostgreSQL suite `postgresql reservation lifecycle` is **skipped** when `TEST_DATABASE_URL` is unset (this sandbox: no Docker, no system Postgres, cannot drop root to run embedded Postgres).

## 5. Reservation regression tests (PGlite)

| Scenario | Result |
|----------|--------|
| Successful payment preserves reservation and confirms | reserved→0, confirmed+=qty, current unchanged |
| Failed payment releases | reserved 0, current restored, group re-opens |
| Expired reservation releases | admin `/expire-stale` |
| Cancelled order releases | `POST /api/orders/:id/cancel` |
| Two customers, last units | 1 × 201, 1 × 409/400, no oversell |
| Failed hold then another buyer | second 201 |
| Duplicate SUCCESS webhook | paid then already_completed; quantities once |
| Repeated payment attempts | same transaction, reserved qty once |
| Group status available/reserved/confirmed | matches counters |

## 6. Build / Docker / audit

- Backend tests: pass (above)
- Docker: engine not available; compose files updated. Runtime `docker compose config` **not executed**.
- Production overlay: Postgres unpublished; frontend bind-mount reset; `JWT_SECRET` / `DB_PASSWORD` required via `:?`
- Dev overlay: Postgres on `127.0.0.1` only

## 7. Remaining external requirements

- Orange Money merchant + OAuth + public HTTPS `notif_url`
- DPO token if cards are required
- DNS, TLS, hosting
- SMS / object storage if those products are enabled
- Run `TEST_DATABASE_URL=... npm run test:pg` on a real PostgreSQL 15 before the first sell-out group

## 8. Known limitations

- Live provider HTTP calls are not executed (no merchant credentials).
- PGlite serializes `getClient()`; `FOR UPDATE` SQL is written for PostgreSQL but **not proven on PostgreSQL in this environment**.
- Mascom wallet is a method label only.
- Refunds have ledger types but no full refund API.
- Orange WebPay does not HMAC-sign notifications; production authenticity is `notif_token` + Transaction Status API.

## 9. Launch classification

**READY FOR CONTROLLED PILOT**

Unpaid/failed orders no longer permanently consume group capacity. Payments still cannot become `paid` without a verified provider notification (`notif_token`, and Transaction Status when credentials exist).

**Not READY FOR PRODUCTION** for live money until Orange Money credentials are issued, `notif_url` is reachable over TLS, a staging payment is confirmed end-to-end, and the PostgreSQL concurrency suite has been run against the staging database.
