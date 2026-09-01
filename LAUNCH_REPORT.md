# Kopano launch report

**Date:** 2026-09-01  
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
| 9 Integration tests | Complete on PGlite — 57 passed; real PostgreSQL suite present, skipped here |
| 10 Security review | Complete |
| 11 Reservation / payment lifecycle (P1) | Complete |
| 12 Role-aware UI/UX overhaul | Complete |

## 2. Important files

- `backend/src/services/reservations.js` — reserved / confirmed / released capacity
- `backend/src/routes/{orders,payments,groups,supplier,agents,admin}.js`
- `backend/src/lib/omWebhook.js` — raw-body parse + optional HMAC; notif_token auth
- `backend/src/schema.sql`, `backend/src/migrations/002_reservations.sql`
- `frontend/src/App.jsx`, `frontend/src/components/AppShell.jsx`, `frontend/src/components/RequireAuth.jsx`
- `frontend/src/api/client.js`
- `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.dev.yml`

## 3. Vulnerabilities / logic bugs (before → after)

| Issue | Before | After |
|-------|--------|--------|
| Unpaid order permanently consumed group quantity | `current_quantity` incremented at checkout; fail left it filled | `reserved_quantity` held until pay/fail/expire/cancel; fail/expire/cancel releases |
| Webhook HMAC over `JSON.stringify(req.body)` | Could diverge from wire bytes | Raw request bytes captured; HMAC only if header/`OM_REQUIRE_HMAC` |
| Orange callback auth guessed as HMAC | Incorrect vs WebPay spec | `notif_token` lookup + Transaction Status API when credentials exist |
| Tracked `.env.txt` | Placeholder secrets in git | Removed from git; ignored |
| Dashboard only exposed Groups/Orders/Rewards/Profile | Other roles and B2B ops were hidden | Role-aware shell + wholesaler/agent/admin workspaces |

## 4. Tests (exact, this environment)

```
cd backend && npm test
# tests 57
# suites 7
# pass 57
# fail 0
# skipped 0
```

`postgresql reservation lifecycle` suite is **skipped** when `TEST_DATABASE_URL` is unset (this sandbox: no Docker, no system Postgres). Node's summary counts that skipped suite as zero tests, not a skipped case.

New isolation tests:

- supplier groups/deliveries scoped to authenticated supplier
- agent shops list is agent-only (customer → 403)

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

- Backend tests: 57 pass
- Frontend production build: `vite build` succeeded (125 modules)
- Backend `npm audit --omit=dev`: 0 vulnerabilities
- Frontend `npm audit --omit=dev`: 2 moderate (react-router 6 SSR/open-redirect). Not force-upgraded to v7 (breaking).
- Docker: engine **not available** in this sandbox (`docker: command not found`). Compose files were inspected, not executed.

Production overlay (source review, not runtime):

- Postgres not published
- frontend bind-mounts reset
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD` required via `:?`
- `PAYMENT_SANDBOX_AUTO_COMPLETE=false`

## 7. UI / role architecture (this pass)

Role-aware `AppShell` (mobile bottom nav + desktop sidebar):

| Role | Home | Navigation |
|------|------|------------|
| customer | `/app` | Home, Buy, Orders, Rewards, Profile |
| supplier (labelled Wholesaler) | `/wholesaler` | Overview, Groups, Orders, Catalogue, Deliveries, Analytics, Profile |
| agent | `/agent` | Home, Shops, Activate, Assist, Profile |
| admin | `/admin` | Overview, Clients, Groups, Revenue, Profile |

Route guards: `RequireAuth` + role wrappers. Backend remains the authority (`requireAdmin` / `requireSupplier` / `requireAgent`).

New backend reads (ownership-scoped, no frontend-supplied supplier id):

- `GET /api/supplier-app/groups`
- `GET /api/supplier-app/deliveries`
- `GET /api/agents/shops`

Live API journey against the running PGlite server:

- register/login shop → 201/200
- list 3 seeded groups → 200
- create order (qty 2, reserved) → 201 `pending_payment`
- customer → admin/supplier/agent APIs → 403
- bad PIN / bad wholesaler login → 401
- cancel order → reservation `released`
- Vite preview on :8080 and `/api` proxy → 200

## 8. Remaining external requirements

- Orange Money merchant + OAuth + public HTTPS `notif_url`
- DPO token if cards are required
- DNS, TLS, SMS, object storage
- Hosting + production secrets (`JWT_SECRET`, `DB_PASSWORD`, provider keys)
- Real PostgreSQL verification via `TEST_DATABASE_URL`
- Docker engine on the deploy host (`docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d`)
- Promote an admin: `UPDATE users SET role = 'admin' WHERE phone = '+2677xxxxxxx';`
- Wholesaler passwords are not in `init.sql` (create via supplier login seed / ops)

## 9. Known limitations

- No live Orange Money confirmation without merchant credentials. Production cannot mark paid from a simulated success path.
- Agent field-commission product is not a separate backend; agent home shows referral ledger + honest note.
- Mascom wallet / card are labelled, not connected.
- PGlite `FOR UPDATE` is not PostgreSQL. Concurrency tests serialize transactions.
- Unused legacy files remain (`Analytics.jsx` fake charts, `BottomNav.jsx`) and are not routed.

## 10. Launch classification

**READY FOR CONTROLLED PILOT**

Not ready for live money until Orange Money (and optional DPO) credentials are issued, HTTPS `notif_url` is live, and production Docker + Postgres are verified on the deploy host.
