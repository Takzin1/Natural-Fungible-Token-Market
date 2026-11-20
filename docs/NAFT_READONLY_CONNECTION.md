# NaFT → NFTM: Offline read-only connection (Bridge v1)

## Scope

This adapter consumes the **actual published contract** of NaFT Core's BlueCarbon bridge receipt, `naft-edition-bridge-receipt/1`. It never copies the original evidence bytes or the NaFT implementation into NFTM. The `NaFT` and `NaFT_BlueCarbon_MRV_Edition` repositories remain untouched. This is an offline CLI connection, **not** live data synchronization or real market issuance.

## Production of a real upstream-generated *research* receipt

In three adjacent local directories:

```sh
# 1. In NaFT_BlueCarbon_MRV_Edition (Node.js 20+)
node src/cli.mjs > /tmp/bluecarbon-export.json

# 2. In NaFT (Node.js 20+)
node scripts/bridge-bluecarbon.mjs /tmp/bluecarbon-export.json > /tmp/naft-receipt.json

# 3. Inspect the published research receipt and pin its receipt_hash through an
#    independent, reviewed trust path. Do not automatically trust the unreviewed file.
#    Edit NFTM's local scenario JSON to use receipt.source_package_hash
#    as source.evidence_package_sha256; all mock assets are separately SYN-*.

# 4. In Natural-Fungible-Token-Market
node scripts/connect-naft.mjs /tmp/naft-receipt.json \
  ./examples/my-reviewed-scenario.json <independently-pinned-receipt_hash>
```

The pin is a SHA-256 of the receipt content **as reported by NaFT**, then checked against an independently selected expected hash. A self-hash or out-of-band pin alone is **not** a digital signature or proof that the publisher is authentic. In research, verify the source commit, input provenance, source package and delivery channel separately.

## Self-contained synthetic contract demo

`examples/naft-bridge-receipt.synthetic.json` is a **hand-generated schema-compatible test fixture**, not an output from NaFT Core's validation engine, and not third-party scientific data.

```sh
npm test
npm run demo:connected
```

## What is checked

- Exact receipt schema, source repository and supported methodology reference.
- Caller-pinned receipt digest, and deterministic JSON content digest.
- Four upstream replay markers `MATCH`, and explicit `false/null` scientific, registry and certification boundaries.
- Unique claim identifiers, valid hash forms, and capped request size.
- Explicit binding of `source_package_hash` to the market scenario input.
- Read-only audit context **without copying raw evidence**.

What it does **not** do: independently reproduce BlueCarbon science, attest origin, validate real-world rights, mint or sell actual credits, call APIs, process payments, or accept legal registry claims. The market still uses unrelated **synthetic entries** with `SYN-` serials. Research estimate amounts **never** increase market supply.

## Further work

- A separate validated adapter for NaFT Core's agricultural compiler envelope (not identical to the BlueCarbon bridge receipt).
- Automated build-to-build compatibility tests with a pinned upstream commit and reproducible synthetic input.
- Provenance staleness checks before displaying mock listings; no real listing mechanism.
- User interface in the research sandbox (currently CLI-only).
