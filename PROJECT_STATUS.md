# COMEPLAYERS PROJECT STATUS

## Current Version

V22 — Seller-Borne 5% Sales Tax and Country/Method Withdrawal Withholding

## Completed platform areas

- Next.js App Router marketplace and responsive gaming UI
- Supabase authentication, buyer accounts, seller approval, and admin authorization
- Product catalog, taxonomy, variants, SKU inventory, ranking, facets, offer comparison, storefronts, followers, and reviews
- Seller dashboard, SLA/service levels, analytics, bulk inventory, and bulk listing CSV import
- Checkout, stock reservation, PayPal, wallet, escrow, order-state controls, and encrypted digital delivery
- Buyer/seller dispute center, evidence, refund decisions, and audit timelines
- Seller payout accounts, withdrawal workflow, payout administration, and payout security controls
- Messaging anti-scam controls, moderation, trust signals, rate limits, and risk tooling
- V18 financial reconciliation, structured logging, cron tracking, and production operations
- V19 webhook inbox/replay, alert routing, Playwright scaffolding, and safe load runner
- V20 checkout kill switch, deterministic canary, provider reconciliation, uptime/SLO monitoring, staging fixtures, and controlled launch operations
- V21 invoice snapshots, prohibited-product enforcement, privacy operations, provider settlement, fraud feedback, and post-launch analytics
- V22 buyer checkout tax disabled for new orders
- V22 fixed 5% seller sales tax withheld when escrow is released
- Marketplace fee and seller tax calculated separately from seller gross proceeds
- Seller-only settlement statement on order and invoice surfaces
- Effective-dated withdrawal tax rules by payout country, payout method, and currency
- Withdrawal rule snapshot, provider fee separation, net payout display, and tax ledger
- Consistent V22 order completion across buyer confirmation, auto-completion, and admin action
- Reconciliation checks for seller settlement and withdrawal arithmetic
- V22 controls integrated into `/admin/compliance` and `/admin/operations`

## V22 settlement model

```text
buyer total = subtotal - discount + buyer payment fee
seller gross = subtotal - discount
seller sales tax = seller gross × 5%
marketplace fee = seller gross × MARKETPLACE_FEE_RATE
seller wallet credit = seller gross - seller sales tax - marketplace fee
```

Withdrawal tax is applied only when a seller requests payout. The exact active rule must match the payout account country, method, and currency.

## Current validation

- Full repository TypeScript: passing
- V22 targeted TypeScript: passing, 30 files checked
- V22 targeted ESLint: passing with zero errors and zero warnings
- Automated unit tests: 45 passing
- SQL and PL/pgSQL static parsing: passing
- Next.js production compilation reached successful application compilation; final full-build worker remains a deployment-environment validation in the extracted workspace
- Database migration and live Supabase/PayPal payout evidence require configured external environments

## V22 database migration

Apply after every migration through V21:

```text
scripts/comeplayers_seller_tax_withholding_v22.sql
```

Verify with:

```text
SELLER_TAX_WITHHOLDING_V22_VERIFY.sql
```

The migration deactivates active V21 buyer-tax rules for new checkout calculations. It does not delete historical tax records and does not retroactively charge paid pre-V22 orders.

## Required withdrawal configuration

V22 intentionally seeds no country tax rates. Before enabling seller withdrawal for a payout combination, create a reviewed active rule in `/admin/compliance` for:

```text
country_code + payout_method + currency
```

A seller withdrawal is blocked when an exact current rule is missing.

## Go-live state

V22 code is complete, but production approval still requires external evidence:

- apply and verify migrations through V22
- confirm buyer tax is zero on a newly created order
- complete a staging order and reconcile gross, marketplace fee, fixed 5% seller tax, and seller wallet credit
- review every existing seller payout account country/currency
- configure reviewed withdrawal rules for every supported country, method, and currency
- test missing-rule rejection and exact-rule selection
- test paid, rejected, and failed withdrawal flows
- confirm tax ledger rows are recognized only for completed sale settlement and paid withdrawal
- run deployed E2E, reconciliation, SLO, alert, backup/restore, mutation load, and production build checks
- pass the V22 tax and withdrawal sign-offs in `/admin/operations`
- follow the V20 controlled canary launch procedure

## Next recommended milestone

V23 — accounting and regional payout maturity:

- tax remittance/payable ledger and accounting period close
- seller tax statements, downloadable CSV, and credit-note adjustments
- verified seller tax residency and payout-country evidence
- provider payout execution and provider fee ingestion
- multi-currency FX snapshots and settlement gain/loss accounting
- country rule approval workflow with dual control
- chargeback lifecycle and provider dispute evidence automation
- advanced cohort, retention, LTV, and seller-quality dashboards
