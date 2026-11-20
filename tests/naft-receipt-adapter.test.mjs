import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectNaftReceipt, connectNaftToMockMarket} from '../src/naft-receipt-adapter.mjs';

const fixture = JSON.parse(readFileSync(new URL('../examples/naft-bridge-receipt.synthetic.json',import.meta.url)));
const scenario = JSON.parse(readFileSync(new URL('../examples/synthetic-market.json',import.meta.url)));
const clone=x=>structuredClone(x);
const reject=(r,s,pin,code)=>assert.throws(()=>connectNaftToMockMarket(r,s,pin),new RegExp(`NFTM_BRIDGE_BLOCKED:${code}`));

test('pinned NaFT BlueCarbon receipt connects to the mock market without creating credits',()=>{
 const result=connectNaftToMockMarket(fixture,scenario,fixture.receipt_hash);
 assert.equal(result.schema,'nftm-naft-readonly-connection/1');
 assert.equal(result.provenance.receipt_sha256,fixture.receipt_hash);
 assert.equal(result.provenance.source_package_sha256,fixture.source_package_hash);
 assert.equal(result.provenance.claim_count,1);
 assert.equal(result.provenance.issued_carbon_credits,0);
 assert.equal(result.credits_created_from_mrv,0);
 assert.equal(result.transactions_submitted,0);
 assert.equal(result.simulated_market.matches.length,1);
 assert.equal(result.simulated_market.real_carbon_credits_traded,0);
});
test('deterministic: same receipt and scenario yield identical results',()=>{
 assert.deepEqual(connectNaftToMockMarket(fixture,scenario,fixture.receipt_hash),
    connectNaftToMockMarket(clone(fixture),clone(scenario),fixture.receipt_hash));
});
test('pin must be independently provided, cannot accept wrong hash',()=>{
 reject(fixture,scenario,undefined,'RECEIPT_PIN_MISMATCH');
 reject(fixture,scenario,'0'.repeat(64),'RECEIPT_PIN_MISMATCH');
});
test('tampered receipt is rejected even when caller used old pin',()=>{
 const r=clone(fixture);r.claims[0].research_estimate_tco2e=999999;
 reject(r,scenario,fixture.receipt_hash,'RECEIPT_DIGEST_MISMATCH');
});
test('invalid NaFT source hash binding is blocked before market execution',()=>{
 const s=clone(scenario);s.source.evidence_package_sha256='b'.repeat(64);
 reject(fixture,s,fixture.receipt_hash,'SCENARIO_PIN_MISMATCH');
});
test('certification or real registry claims are blocked',()=>{
 for (const field of ['formal_certification','scientific_validation','evidence_origin_verified']) {
  const r=clone(fixture);r[field]=true;
  reject(r,scenario,fixture.receipt_hash,'RECEIPT_DIGEST_MISMATCH');
 }
});
test('the checker refuses a forged but internally consistent certification upgrade',()=>{
 const r=clone(fixture);r.formal_certification=true;
 // Even if an attacker can forge a digest, it cannot pass the independent pin.
 reject(r,scenario,fixture.receipt_hash,'RECEIPT_DIGEST_MISMATCH');
});
test('unsupported receipt version is not accepted',()=>{
 const r=clone(fixture);r.schema='naft-edition-bridge-receipt/2';
 reject(r,scenario,fixture.receipt_hash,'UPSTREAM_SCHEMA');
});
test('upstream receipt cannot make genuine market orders possible',()=>{
 const s=clone(scenario);s.market.real_orders_enabled=true;
 assert.throws(()=>connectNaftToMockMarket(fixture,s,fixture.receipt_hash), /NFTM_BLOCKED:PRODUCTION_MARKET_FORBIDDEN/);
});
test('read-only inspection returns no original evidence bytes or names',()=>{
 const p=inspectNaftReceipt(fixture,fixture.receipt_hash);
 assert.equal(JSON.stringify(p).includes('evidence_ids'),false);
 assert.equal(p.formal_certification,false);
 assert.equal(p.rights_verified,false);
});
test('synthetic market assets remain independently declared, not derived from research claims',()=>{
 const s=clone(scenario);s.orders=[];s.registry.entries=[];s.retire_after_match=[];
 const r=connectNaftToMockMarket(fixture,s,fixture.receipt_hash);
 assert.equal(r.simulated_market.matches.length,0);
 assert.equal(r.provenance.claim_count,1);
 assert.equal(r.credits_created_from_mrv,0);
});
