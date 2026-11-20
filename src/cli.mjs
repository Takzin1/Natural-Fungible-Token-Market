#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {runMarketScenario} from './market.mjs';

try {
  if (process.argv.length !== 3) throw new Error('USAGE: npm run demo or node src/cli.mjs <scenario.json>');
  const buffer = await readFile(process.argv[2]);
  if (buffer.length > 200000) throw new Error('NFTM_BLOCKED:INPUT_SIZE');
  const scenario = JSON.parse(buffer.toString('utf8'));
  process.stdout.write(`${JSON.stringify(runMarketScenario(scenario), null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'INVALID_INPUT');
  process.exitCode = 1;
}
