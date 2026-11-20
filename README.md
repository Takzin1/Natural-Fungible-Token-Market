# Natural Fungible Token Market (NFTM)

**A research-only market sandbox for environmental asset scenarios, referencing the NaFT digital MRV evidence platform.**

> **Development status:** independent initial prototype. All registry records, orders, stable-unit quotations, fills, and retirements are fictitious. This repository does not create carbon credits, legal ownership, real stablecoins, transferable tokens, financial products, or actual market transactions.

## Relationship to NaFT

- Original dMRV upstream: [Takzin1/NaFT](https://github.com/Takzin1/NaFT).
- Existing separate tokenization research preview: [NaFT IEEE Edition](https://github.com/Takzin1/NaFT-IEEE_Climate_Hackathon_Edition).
- **No source code or datasets have been copied from those repositories into NFTM.** The first version uses only a synthetic SHA-256 placeholder and an independently authored order-matching simulation.
- Implemented first integration: a versioned, **offline, read-only** NaFT BlueCarbon research receipt adapter. See [connection runbook](docs/NAFT_READONLY_CONNECTION.md). A valid dMRV receipt is *not* evidence of an issued, transferable credit. A separately verified registry/rights layer would be necessary for production.

## What works today

- Deterministic synthetic registry and one-unit-per-serial order matching.
- Illustrative simulated JPY -> USD-pegged reference-unit pricing, with exact integer arithmetic and clearly labelled **user-assumed** FX/peg rates.
- Denial of already-retired, unlocked, or duplicate-claim synthetic registry entries.
- Duplicate listing and duplicate retirement protections in the mock model.
- Reproducible machine-readable JSON receipt with SHA-256 checksum.
- Offline read-only NaFT BlueCarbon bridge receipt input with explicitly pinned receipt SHA-256. No source estimate becomes an issued asset.
- Zero external network calls, keys, wallets, RPC transactions, real custody, or real payments.

## Quick start

Requires Node.js 20+; no npm install or API key required.

```sh
npm test
npm run demo
npm run demo:connected   # schema-compatible synthetic NaFT receipt + market
# alternatively:
node src/cli.mjs examples/synthetic-market.json
```

**Important:** This is a *unit test and CLI demo*, not a deployed marketplace, exchange or real-world scientific validation.

## Future research

1. Extend the existing `naft-edition-bridge-receipt/1` BlueCarbon intake to other NaFT Core research output schemas (not yet implemented).
2. Explicit separation of research estimates, external accreditation, registered legal rights, and market representations.
3. A sandbox order book and web UI for simulated asset offers and matching.
4. Multiple reference pricing sources and deliberate missing/stale-price handling.
5. Re-verification propagation: revoked/changed evidence -> suspension of simulated listings.
6. Red-team tests (duplicate selling, bad serials, inconsistent FX, stale evidence, unsigned rights claims).
7. Hackathon-specific adapters without merging live financial logic into the NaFT core.

See [architecture](docs/ARCHITECTURE.md) and [research roadmap](docs/ROADMAP.md).

## Licensing and contribution notice

**No LICENSE file is provided intentionally.** Public visibility on GitHub does **not** mean open-source licensing. No general permission to copy, redistribute, modify or sell NFTM source code is granted by this repository. GitHub's Terms of Service still govern platform features such as viewing and forking.

NaFT upstream is separately licensed. If any NaFT source is ever incorporated into NFTM, its applicable copyright and license notices must be preserved. Third-party data and methodology rights require separate checks.

This repository is a research prototype, not legal, investment or environmental certification advice.
