import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMarketScenario, quoteSimulatedStableUnits} from '../src/market.mjs';
const fixture = JSON.parse(readFileSync(new URL('../examples/synthetic-market.json',import.meta.url)));
const clone = x => structuredClone(x);
const blocked = (x, code) => assert.throws(()=>runMarketScenario(x), new RegExp(`NFTM_BLOCKED:${code}`));

test('synthetic market matches one eligible serial and denies production claims',()=>{
  const result = runMarketScenario(fixture);
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].serial,'SYN-BC-001');
  assert.equal(result.matches[0].execution_price_jpy,'3000');
  assert.equal(result.blocked_orders.length,1);
  assert.equal(result.blocked_orders[0].reason,'SYNTHETIC_REGISTRY_GATE_FAILED');
  assert.equal(result.real_carbon_credits_traded,0);
  assert.equal(result.real_stablecoin_transferred,false);
  assert.equal(result.onchain_transactions_submitted,false);
  assert.equal(result.production_mint_authorized,false);
});
test('mock retirement requires a match and cannot imply real retirement',()=>{
  const r = runMarketScenario(fixture);
  assert.deepEqual(r.simulated_retirements.map(x=>x.status),['SIMULATED_RETIRED_ONLY','BLOCKED_NO_MATCH']);
});
test('price conversion is exact, integer based and deterministic',()=>{
  assert.equal(quoteSimulatedStableUnits('3000','150.25','1.00'),'19.966722');
  assert.equal(quoteSimulatedStableUnits('1','100','1'),'0.01');
  assert.deepEqual(runMarketScenario(fixture),runMarketScenario(clone(fixture)));
});
test('research output is not an issued credit or real market right',()=>{
  const x=clone(fixture);x.source.formal_certification=true;
  blocked(x,'RESEARCH_SOURCE_REQUIRED');
  const y=clone(fixture);y.source.verification_status='CERTIFIED';
  blocked(y,'RESEARCH_SOURCE_REQUIRED');
  const z=clone(fixture);z.registry.id='VERRA';
  blocked(z,'SYNTHETIC_REGISTRY_ONLY');
});
test('real orders and payments are prohibited',()=>{
  const x=clone(fixture);x.market.real_payments_enabled=true;
  blocked(x,'PRODUCTION_MARKET_FORBIDDEN');
  const y=clone(fixture);y.market.real_orders_enabled=true;
  blocked(y,'PRODUCTION_MARKET_FORBIDDEN');
});
test('duplicate registry serials fail closed',()=>{
  const x=clone(fixture);x.registry.entries.push(clone(x.registry.entries[0]));
  blocked(x,'DUPLICATE_REGISTRY_SERIAL');
});
test('duplicate listing cannot create double matched asset',()=>{
  const x=clone(fixture);x.orders.push({...clone(x.orders[0]),id:'ORD-S3'});
  const r=runMarketScenario(x);
  assert.equal(r.matches.length,1);
  assert.ok(r.blocked_orders.some(v=>v.order_id==='ORD-S3'&&v.reason==='ONE_SELL_PER_SYNTHETIC_SERIAL'));
});
test('no match when bid lower than asking price',()=>{
  const x=clone(fixture);x.orders[1].limit_price_jpy='2999';
  assert.equal(runMarketScenario(x).matches.length,0);
});
test('invalid peg and currency formats are blocked',()=>{
  assert.throws(()=>quoteSimulatedStableUnits('3000','0','1'),/INVALID_FX_ASSUMPTION/);
  assert.throws(()=>quoteSimulatedStableUnits('3000','150.25','0'),/INVALID_PEG_ASSUMPTION/);
  assert.throws(()=>quoteSimulatedStableUnits('1e3','150','1'),/INVALID_JPY/);
});
test('duplicate retirement requests are blocked',()=>{
  const x=clone(fixture);x.retire_after_match.push('SYN-BC-001');
  blocked(x,'DUPLICATE_RETIRE_REQUEST');
});
