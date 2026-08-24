# Kopano — Group buying for Botswana SMEs

Mobile-first B2B group-buying. Businesses pool demand to access wholesale prices in BWP.

## Architecture

- API: Node.js / Express 5 + PostgreSQL 15
- Frontend: React (Vite) + Tailwind, PWA (network-first for API)
- Auth: JWT access + refresh, PIN, RBAC (`customer` | `agent` | `supplier` | `admin`)
- Payments: Orange Money adapter, idempotent ledger, HMAC webhooks
- **No simulated production payment success**

## Development

```bash
cp .env.example .env
docker compose --profile dev up --build
```

- App: http://localhost:5173
- API: http://localhost:3000
- Health: http://localhost:3000/health

## Tests

```bash
cd backend && npm test
```

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Mandatory production env: `NODE_ENV=production`, `JWT_SECRET` (≥32 chars), `DATABASE_URL`, `CORS_ORIGINS`.

Without `OM_*` credentials, payments remain `awaiting_confirmation` until a **signed** webhook confirms them.

Promote an admin:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+2677xxxxxxx';
```

## External activation (blocked until issued)

1. Orange Money merchant + OAuth client + webhook secret
2. DPO company token (optional cards)
3. DNS, TLS, SMS (Africa's Talking), object storage
