# ComePlayers

ComePlayers is a full-stack gaming marketplace built with Next.js, React, Supabase, and PayPal. It supports buyer checkout, seller listings and variants, digital delivery, wallet and escrow, disputes and refunds, seller payouts, storefronts, search/ranking, anti-scam messaging, reconciliation, controlled launch operations, and commerce compliance.

## Current milestone

**V22 — Seller-Borne Tax and Withdrawal Withholding**

V22 changes the commerce tax model:

- buyer checkout tax is zero for new orders;
- sellers bear a fixed 5% sales tax on gross sale proceeds;
- marketplace fees remain separate;
- seller wallet credit is net of marketplace fee and seller sales tax;
- withdrawal tax is applied only at payout request time;
- withdrawal rules match payout country, method, and currency;
- order, invoice, wallet, admin, metrics, and reconciliation flows use the same settlement model;
- paid pre-V22 orders are not retroactively charged.

See `PROJECT_STATUS.md`, `SELLER_TAX_WITHHOLDING_V22_INSTALL.md`, and `SELLER_TAX_WITHHOLDING_V22_RUNBOOK.md`.

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Quality commands

```bash
npm run typecheck:v22
npm run typecheck:e2e
npm run lint
npm run test
npm run build
```

The full production build should also be run in a production-equivalent deployment environment with all required variables and services.

## Database

Apply migrations in milestone order. After V21, run:

```text
scripts/comeplayers_seller_tax_withholding_v22.sql
```

Verify with:

```text
SELLER_TAX_WITHHOLDING_V22_VERIFY.sql
```

No withdrawal-tax rate is seeded automatically. Configure reviewed active rules from `/admin/compliance` before allowing seller withdrawals.

## Main V22 surfaces

```text
/orders/[id]
/orders/[id]/invoice
/seller/orders
/seller/payouts
/admin/withdrawals
/admin/compliance
/admin/operations
```

## Settlement example

For a Rp100,000 sale with a 5% marketplace fee and the fixed 5% seller sales tax:

```text
Buyer pays                         Rp100,000
Marketplace fee                     Rp5,000
Seller sales tax                    Rp5,000
Seller wallet credit               Rp90,000
```

A buyer-facing PayPal payment fee, when configured, is separate and does not enter seller proceeds.

## Staging and E2E

```bash
npx playwright install --with-deps chromium
E2E_BASE_URL=https://staging.example.com E2E_START_SERVER=false npm run test:e2e:smoke
```

Deterministic fixtures:

```bash
FIXTURE_ENV=staging FIXTURE_CONFIRM=COMEPLAYERS_STAGING_ONLY E2E_FIXTURE_PASSWORD='secret-from-vault' npm run fixtures:seed
npm run e2e:auth
FIXTURE_ENV=staging FIXTURE_CONFIRM=COMEPLAYERS_STAGING_ONLY npm run fixtures:cleanup
```

Safe load test:

```bash
LOAD_BASE_URL=https://staging.example.com npm run test:load
```

Mutation testing requires `LOAD_ALLOW_MUTATIONS=true` and `LOAD_ENVIRONMENT=staging` or `test`. Use disposable staging data only.

## Production checklist

1. Apply and verify all migrations through V22.
2. Verify a new buyer order has zero buyer tax.
3. Verify seller settlement deducts marketplace fee and fixed 5% seller sales tax from seller gross.
4. Review existing payout-account country and currency values.
5. Configure a reviewed current withdrawal rule for every live country + method + currency combination.
6. Test paid, rejected, and failed withdrawal flows plus seller tax ledger evidence.
7. Run TypeScript, ESLint, unit, deployed E2E, load, reconciliation, SLO, alert, backup/restore, and production build checks.
8. Pass all launch sign-offs in `/admin/operations`.
9. Follow `PRODUCTION_CANARY_RUNBOOK_V20.md` for controlled rollout and rollback.

The fixed 5% seller tax and country withdrawal rules must be reviewed by qualified tax/accounting professionals before production use.

Never commit `.env.local`, service-role keys, encryption keys, webhook secrets, Playwright auth state, fixture passwords, or payout credentials.
