# Kopano — Group buying for Botswana SMEs

Mobile-first B2B group-buying. Businesses pool demand to access wholesale prices in BWP.

## Architecture

- API: Node.js / Express 5 + PostgreSQL 15
- Frontend: React (Vite) + Tailwind, PWA (network-first for API)
- Auth: JWT access + refresh, PIN, RBAC (`customer` | `agent` | `supplier` | `admin`)
- Payments: Orange Money WebPay adapter, idempotent ledger
- Capacity: reserved / confirmed / released (unpaid orders do not permanently consume group quantity)
- **No simulated production payment success**

## Development

```bash
cp .env.example .env
docker compose --profile dev up --build
```

- App: http://localhost:5173
- API: http://localhost:3000
- Health: http://localhost:3000/health

Postgres is published on loopback only with the dev overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev up --build
```

## Tests

```bash
cd backend && npm test
```

Real PostgreSQL concurrency tests (not PGlite):

```bash
cd backend
TEST_DATABASE_URL=postgres://kopano:change-me@127.0.0.1:5432/kopano npm run test:pg
```

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Mandatory production env: `NODE_ENV=production`, `JWT_SECRET` (≥32 chars), `JWT_REFRESH_SECRET`, `DATABASE_URL` / `DB_PASSWORD`, `CORS_ORIGINS`.

Orange Money WebPay notifications authenticate with the `notif_token` returned at initiation. When merchant credentials exist, SUCCESS is confirmed via the Transaction Status API (`pay_token`) before an order is marked paid. Optional HMAC (`OM_REQUIRE_HMAC=true`) is for signed test adapters only — it is **not** part of the Orange WebPay spec.

Promote an admin:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+2677xxxxxxx';
```

## External activation (blocked until issued)

1. Orange Money merchant + OAuth client + public HTTPS `notif_url`
2. DPO company token (optional cards)
3. DNS, TLS, SMS (Africa's Talking), object storage
