# COMEPLAYERS PROJECT STATUS

## Current Version

V23.1 — Finance Governance with Professional Authentication Experience

## Completed platform areas

- Full Next.js gaming marketplace with Supabase authentication and admin/seller/buyer authorization
- Catalog, variants, inventory, ranking, storefronts, followers, reviews, checkout, PayPal, wallet, escrow, and encrypted delivery
- Disputes, refunds, anti-scam messaging, moderation, risk, seller payout security, reconciliation, alerting, launch controls, privacy, and compliance
- V22 seller-borne sales tax and country/method/currency withdrawal withholding
- V23 immutable marketplace-fee and seller-tax snapshots per order
- V23 versioned rate histories and two-person approval for marketplace fee, seller sales tax, and active withdrawal-tax changes
- V23 verified seller tax residency with encrypted identifiers
- V23 monthly seller tax statements and accounting-period close
- V23 wallet-to-payout FX quotes and immutable withdrawal FX snapshots
- V23 PayPal provider payout submission, synchronization, attempts, and provider-fee evidence
- V23.1 professional split login/register modal, password-strength guidance, real Remember me persistence, email verification, forgot-password recovery, request cooldowns, and public legal pages

## V23 settlement guarantees

```text
buyer total = subtotal - discount + buyer payment fee
seller gross = subtotal - discount
marketplace fee = seller gross × snapshotted marketplace fee rate
seller sales tax = seller gross × snapshotted seller tax rate
seller wallet credit = seller gross - marketplace fee - seller sales tax
```

A rate change never rewrites an existing order snapshot. Withdrawal tax and FX are frozen at withdrawal request time.

## Main surfaces

- Seller tax residency: `/seller/tax-profile`
- Seller tax statements: `/seller/tax-statements`
- Seller payouts and FX quote: `/seller/payouts`
- Finance governance: `/admin/compliance`
- Provider payout execution: `/admin/withdrawals`
- Launch/readiness gates: `/admin/operations`
- Password recovery: `/reset-password`
- Public terms: `/terms`
- Public privacy policy: `/privacy`

## Database

Apply after V22:

```text
scripts/comeplayers_finance_governance_v23.sql
```

Verify with:

```text
FINANCE_GOVERNANCE_V23_VERIFY.sql
```

## Current validation

- Full repository TypeScript: passing
- V23 targeted TypeScript: passing, 30 files checked
- Changed TypeScript/TSX ESLint: zero errors and zero warnings
- Automated unit tests: 60 passing
- Authentication TypeScript and ESLint: passing with zero auth-file warnings
- Playwright collection: 9 scenarios detected
- SQL static parse: 90 statements parsed
- Full production build was not repeated after a prior parallel Next.js worker exhausted/reset the temporary workspace; deployment-environment build remains required
- Supabase migration and real PayPal Payouts evidence require external credentials and were not executed from this workspace

## Next recommended milestone

V24 — chargeback lifecycle, accounting adjustments/credit notes, provider settlement gain/loss, scheduled rate activation monitoring, downloadable statement exports, and cohort/LTV dashboards.
