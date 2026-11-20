#!/usr/bin/env node
/** CLI: node scripts/connect-naft.mjs receipt.json scenario.json <pinned-receipt-sha256> */
import {readFile} from 'node:fs/promises';
import {connectNaftToMockMarket} from '../src/naft-receipt-adapter.mjs';

async function parseJson(path, maxBytes) {
  const bytes = await readFile(path);
  if (bytes.length > maxBytes) throw new Error('NFTM_BRIDGE_BLOCKED:INPUT_SIZE');
  return JSON.parse(bytes.toString('utf8'));
}
try {
  if (process.argv.length !== 5) throw new Error('USAGE: node scripts/connect-naft.mjs <receipt.json> <scenario.json> <pinned-receipt-sha256>');
  const receipt = await parseJson(process.argv[2], 1024 * 1024);
  const scenario = await parseJson(process.argv[3], 200000);
  process.stdout.write(JSON.stringify(connectNaftToMockMarket(receipt,scenario,process.argv[4]), null, 2) + '\n');
} catch (e) {
  const message = String(e?.message ?? 'UNKNOWN');
  console.error(/^(USAGE:|NFTM_BRIDGE_BLOCKED:|NFTM_BLOCKED:)/.test(message) ? message : 'NFTM_BRIDGE_BLOCKED:INVALID_INPUT');
  process.exitCode = 1;
}
