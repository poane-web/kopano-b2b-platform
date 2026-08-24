# Kopano launch report

**Date:** 2026-08-24  
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
| 9 Integration tests | Complete — 38 passed |
| 10 Security review | Complete |

## 2. Important files

- `backend/src/app.js` — route mount, security middleware
- `backend/src/middleware/auth.js` — JWT + RBAC
- `backend/src/routes/{auth,orders,payments,admin,supplier,agents,referrals,groups}.js`
- `backend/src/schema.sql`
- `backend/test/*.test.js`
- `frontend/src/api/client.js`, `stores/authStore.js`, `pages/Checkout.jsx`, `public/sw.js`
- `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`

## 3. Vulnerabilities (before → after)

| Issue | Before | After |
|-------|--------|--------|
| Routes not mounted / mock API | Demo endpoints only | Canonical `/api/*` modules mounted |
| Admin `next()` | Open | 401 unauth / 403 non-admin |
| Simulated payment success | Immediate `paid` | `awaiting_confirmation` until signed webhook |
| Empty auth/db modules | 0-byte | Production pool + JWT |
| Hard-coded payee phone | `+26771234567` | Profile MSISDN / none |
| CSV split on comma | Naive | Quoted parser + validation + no persist by default |
| SW cached `/api` | Stale money | Network-only, no API cache |
| JWT dev fallback in prod | Yes | Fail-fast if secret missing/weak |
| IDOR orders/suppliers | Unscoped | Owner/supplier_id scoped, 404 |

## 4. Tests (exact)

```
# tests 38
# suites 4
# pass 38
# fail 0
# skipped 0
```

## 5. Integration results

| Scenario | Result |
|----------|--------|
| Order concurrency (1 remaining, 2 buyers) | 1 × 201, 1 × 400/409, `current_quantity = 100` |
| Duplicate payment (same idempotency key) | Single transaction |
| Duplicate webhook | First `paid`, second `already_completed`, savings once |
| Forged webhook (missing/invalid HMAC) | 401, order not paid |
| Amount tampering | Client amount ignored; webhook amount mismatch 400 |
| Admin unauth / customer / supplier / agent | 401 / 403 / 403 / 403; admin 200 |
| Supplier isolation | Cross-tenant order 404 |
| Agent isolation | Cannot access supplier APIs (403); unknown order 404 |

## 6. Build

- Backend syntax + tests: pass
- Frontend `vite build`: pass (113 modules)
- Docker: engine not available in this environment; Dockerfiles and compose written. `docker compose config` not executed here.

## 7. Dependency scan

`npm audit --omit=dev` (backend): **0 vulnerabilities**

## 8. Remaining external requirements

- Orange Money merchant ID, OAuth client, webhook HMAC secret, production API URL
- DPO token if cards are required
- DNS, TLS, hosting
- SMS (Africa's Talking) if OTP/notifications required
- Object storage credentials if document KYC is required
- Merchant / Bank of Botswana operational approval

## 9. Known limitations

- Live provider HTTP calls are not executed (no merchant credentials). Adapter + HMAC + idempotency are tested with mocks/unsigned-fail-closed.
- Concurrency tests run on PGlite with serialized transactions; SQL uses `FOR UPDATE` for real PostgreSQL.
- Mas/Mascom wallet is accepted as a method label; only Orange Money has an adapter.
- Refunds have ledger types but no full refund API yet.
- PGlite in-memory mode is **dev-only** when `DATABASE_URL` is unset.

## 10. Launch classification

**READY FOR CONTROLLED PILOT**

Code is ready to register businesses, run groups, create orders, and record payments as pending until a **real signed provider webhook** arrives.

**Not READY FOR PRODUCTION** for live money until Orange Money (or DPO) credentials are issued, webhook URL is reachable over TLS, and a staging payment is confirmed end-to-end with the provider.
