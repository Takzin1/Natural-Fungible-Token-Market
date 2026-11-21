# Architecture — separate market sandbox over an evidence core

## Boundary design

```text
NaFT Core (separate upstream, MIT notice retained upstream)
    version-aware evidence + synthetic research receipt
    │  future schema-checked, read-only import
    ▼
NFTM Evidence Adapter (future) ── Research estimates are NOT tradeable rights
    │
    ▼
Synthetic Registry/Rights Gate (implemented for mock fixtures only)
    │  MOCK_ISSUED + MOCK_LOCKED + not duplicate-claimed
    ▼
Deterministic Order Matching (implemented: 1 synthetic unit per serial)
    ├── JPY quote calculation (implemented)
    ├── synthetic USD-pegged reference conversion (implemented)
    └── mock retirement after matched trade (implemented)

PRODUCTION: all real issuance, transactions, swaps, wallets and payments disabled.
```

## Invariants

1. A dMRV scientific estimate is never automatically an issued carbon credit.
2. The only accepted registry is `NFTM-SYNTHETIC-REGISTRY`.
3. All demo serials begin `SYN-`, and a serial can be sold at most once per run.
4. Revoked, retired, unlocked or duplicate-claimed synthetic items cannot match.
5. `real_orders_enabled` and `real_payments_enabled` must remain false.
6. Conversion assumptions are user supplied; `SYN` reference units are not real coins.
7. Output explicitly reports zero real traded credits and no actual stablecoin movement.
8. UI views, pricing APIs, custody and multi-user persistence do not yet exist.

## What is not tested

Actual rights custody, interoperability with NaFT live data, scientific accuracy, regulatory compliance, banking rails, network security, multi-tenant authorization, concurrency, auction fairness, market liquidity and stablecoin peg reliability.

## IP boundary

NFTM is independently authored here: no NaFT MIT-licensed implementation is vendored. A future shared dependency would preserve the original MIT attribution and notice, without automatically licensing NFTM's new source. Original data licensing must be checked separately.

## Valuation book

The [v1 wire adapter](P80_VALUATION.md) consumes exported JSON and a separately maintained head pin per synthetic listing. It delegates unit conversion to the same quoteSimulatedStableUnits function as the legacy book. Registry, order priority, duplicate sale and retirement checks stay in runMarketScenario. Each match carries both the legacy synthetic result and the net reference settlement in the selected scenario denomination.
