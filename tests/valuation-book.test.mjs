import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {digest,runMarketScenario} from '../src/market.mjs';
import {runValuationBook} from '../src/valuation-book.mjs';
const read = name => JSON.parse(readFileSync(new URL('../examples/p80-'+name+'.json',import.meta.url)));
const at='2026-11-21T00:00:00.000Z',later='2026-11-21T00:01:00.000Z';
function fixture() {return [read('scenario'),read('bindings'),read('history')];}
function sign(r) {delete r.receipt_sha256;r.receipt_sha256=digest(r);return r;}
test('upstream v1 export replays; order book, matched fee and retirement agree with legacy simulation',()=>{
  const [s,b,h]=fixture(),book=runValuationBook(s,b,h,at),legacy=runMarketScenario(s);
  const [m]=book.simulated_market.matches;
  assert.deepEqual(book.orders,s.orders);assert.equal(book.listings[0].quote.reference_value_jpy,'3360');
  assert.equal(m.simulated_stable_units,legacy.matches[0].simulated_stable_units);
  assert.equal(m.valuation_settlement.execution_jpy,'3000');
  assert.equal(m.valuation_settlement.gross_amount,'19.966722');
  assert.equal(m.valuation_settlement.estimated_fee,'0.049916');
  assert.equal(m.valuation_settlement.net_amount,'19.916806');
  assert.deepEqual(book.simulated_market.simulated_retirements,legacy.simulated_retirements);
});
test('current external head rejects stale ancestor; verified successor suspends both sides',()=>{
  const [s,b,h]=fixture(),next=read('suspension');b[0].current_receipt_sha256=next.receipt_sha256;
  assert.throws(()=>runValuationBook(s,b,h,later),/CURRENT_HEAD/);
  h[0].push(next);const book=runValuationBook(s,b,h,later);
  assert.equal(book.listings[0].state,'SUSPENDED_REVERIFICATION');assert.equal(book.simulated_market.matches.length,0);
  assert.equal(book.simulated_market.blocked_orders.filter(o=>o.reason==='SUSPENDED_REVERIFICATION').length,2);
  assert.ok(book.simulated_market.simulated_retirements.every(v=>v.status==='BLOCKED_NO_MATCH'));
});
test('expiry at the boundary blocks matching and settlement even for valid historical receipt',()=>{
  const [s,b,h]=fixture(),r=runValuationBook(s,b,h,h[0][0].quote.quote_expiry);
  assert.equal(r.listings[0].state,'SUSPENDED_EXPIRED');assert.equal(r.simulated_market.matches.length,0);
});
test('tampering, replacing the out-of-band pin, extra fields and schema downgrade rejected',()=>{
  const [s,b,h]=fixture(),r=h[0][0];r.quote.net_amount='999';
  assert.throws(()=>runValuationBook(s,b,h,at),/DIGEST/);sign(r);
  assert.throws(()=>runValuationBook(s,b,h,at),/SETTLEMENT_REPLAY/);b[0].current_receipt_sha256=r.receipt_sha256;
  assert.throws(()=>runValuationBook(s,b,h,at),/SETTLEMENT_REPLAY/);
  r.quote.wallet='test';assert.throws(()=>runValuationBook(s,b,h,at),/WIRE_SCHEMA/);
});
test('research evidence creates no registry entries, orders or retirement requests',()=>{
  const [s,b,h]=fixture();s.orders=[]; const before=structuredClone(s);
  const r=runValuationBook(s,b,h,at);assert.deepEqual(s,before);assert.equal(r.simulated_market.matches.length,0);
  assert.equal(r.credits_created_from_mrv,0);assert.equal(r.real_rights_verified,false);
  s.registry.entries=[];assert.throws(()=>runValuationBook(s,b,h,at),/SERIAL_BINDING/);
});
test('a suspended listing leaves an independently pinned eligible serial active',()=>{
  const [s,b,h]=fixture(),next=read('suspension');
  const other=structuredClone(h[0][0]);other.input.asset.asset_id='other';
  other.input.asset.evidence_package_sha256='b'.repeat(64);sign(other);
  s.registry.entries.push({...s.registry.entries[0],serial:'SYN-OTHER'});
  for (const o of s.orders.slice(0,2)) s.orders.push({...o,id:o.id+'-OTHER',serial:'SYN-OTHER'});
  b.push({...b[0],asset_id:'other',serial:'SYN-OTHER',initial_evidence_package_sha256:'b'.repeat(64),current_receipt_sha256:other.receipt_sha256});
  h.push([other]);h[0].push(next);b[0].current_receipt_sha256=next.receipt_sha256;
  const r=runValuationBook(s,b,h,later);assert.deepEqual(r.simulated_market.matches.map(m=>m.serial),['SYN-OTHER']);
});
test('duplicate evidence across synthetic serials and non-contiguous revisions are rejected',()=>{
  const [s,b,h]=fixture();b.push({...b[0],serial:s.registry.entries[1].serial});h.push(h[0]);
  assert.throws(()=>runValuationBook(s,b,h,at),/DOUBLE_EVIDENCE/);
  const next=read('suspension');next.previous_receipt_sha256='f'.repeat(64);sign(next);
  assert.throws(()=>runValuationBook(s,[b[0]],[[h[0][0],next]],later),/LINEAGE/);
});
test('issuer metadata cannot introduce an executable right, wrong pair, or mismatched verified quantity',()=>{
  for (const mutate of [r=>r.formal_certification=true,r=>r.input.asset.rights_status='ISSUED',
    r=>r.quote.quote_currency='JPY',r=>r.input.quantity_override='100',r=>r.input.snapshot.price.source='UNKNOWN']) {
    const [s,b,h]=fixture(),r=h[0][0];mutate(r);sign(r);b[0].current_receipt_sha256=r.receipt_sha256;
    assert.throws(()=>runValuationBook(s,b,h,at),/BLOCKED/);
  }
});

test('research JPY principal cannot be inflated even when gross, net and digest are consistent',()=>{
  const [s,b,h]=fixture(),r=h[0][0];
  r.quote.reference_value_jpy='3400';r.quote.fx_principal_jpy='3400';sign(r);b[0].current_receipt_sha256=r.receipt_sha256;
  assert.throws(()=>runValuationBook(s,b,h,at),/VALUATION_REPLAY/);
});
test('HTML order book renders settlement and escapes untrusted display identifiers',async()=>{
  const {valuationReport}=await import('../src/valuation-report.mjs');
  const book=runValuationBook(...fixture(),at);
  book.listings[0].serial='<bad>';const html=valuationReport(book);
  for (const text of ['22.362728','19.916806','&lt;bad&gt;','SIMULATED_NO_PAYMENT','仮定に基づく参考値']) assert.ok(html.includes(text));
  assert.ok(!html.includes('<bad>'));
});
