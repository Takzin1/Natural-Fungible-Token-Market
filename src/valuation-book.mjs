// Read-only v1 JSON protocol. The trusted current head is supplied separately.
import {readFileSync} from 'node:fs';
import {digest,runMarketScenario,settlementReference} from './market.mjs';

const schema = JSON.parse(readFileSync(new URL('../schemas/valuation-quote-v1.json',import.meta.url)));
function check(ok,code) { if (!ok) throw new Error('NFTM_VALUATION_BLOCKED:' + code); }
function conforms(v,s) {
  if (s.$ref) return conforms(v,schema.$defs[s.$ref.slice('#/$defs/'.length)]);
  if ('const' in s) return v === s.const;
  if (s.enum) return s.enum.includes(v);
  if (s.anyOf) return s.anyOf.some(branch => conforms(v,branch));
  switch (s.type) {
    case 'null': return v === null;
    case 'string': return typeof v === 'string' && v.length >= (s.minLength ?? 0) &&
      v.length <= (s.maxLength ?? Infinity) && (!s.pattern || new RegExp(s.pattern).test(v));
    case 'boolean': return typeof v === 'boolean';
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v) &&
      Object.keys(v).length === s.required.length &&
      s.required.every(k => Object.hasOwn(v,k) && conforms(v[k],s.properties[k]));
    default: throw new Error('UNSUPPORTED_SCHEMA_KEYWORD');
  }
}
function date(s) {
  check(typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s,'DATE');
  return s;
}
function scaled(value,places,whole) {
  const [left,right=''] = value.split('.');
  check(left.length <= whole && right.length <= places,'DECIMAL_RANGE');
  return BigInt(left + right.padEnd(places,'0'));
}
function inspect(r) {
  check(conforms(r,schema),'WIRE_SCHEMA');
  const {receipt_sha256,...body} = r;
  check(digest(body) === receipt_sha256,'RECEIPT_DIGEST');
  date(r.as_of);
  if (r.status === 'BLOCKED') {
    check(r.quote === null && Object.values(r.states).some(s=>s!=='VALID'),'BLOCKED_SHAPE');
    return;
  }
  const {input:i,quote:q} = r, a = i.asset, snap = i.snapshot;
  check(q && Object.values(r.states).every(s=>s==='VALID') &&
    a.quantity !== null && a.quantity_unit === 'tCO2e' && a.rights_status === 'UNVERIFIED' &&
    ['REFERENCE','RESEARCH_ESTIMATE'].includes(a.verification_status) &&
    ['AGRICULTURE','BLUE_CARBON','FORESTRY'].includes(a.asset_category) &&
    !(a.methodology_id === 'AG-005' && a.methodology_version === '3.1-reference'),'RESEARCH_GATE');
  check(q.asset_symbol === i.asset_symbol && q.quote_currency === (i.asset_symbol === 'JPYC' ? 'JPY' : 'USD') &&
    snap.fx?.pair === 'JPY/USD' && snap.price?.pair === 'JPY/tCO2e' &&
    snap.peg?.pair === q.quote_currency + '/' + i.asset_symbol,'CURRENCY');
  for (const o of Object.values(snap)) {
    check(o && o.source.trim() && ['USER_INPUT','SYNTHETIC'].includes(o.source_kind) && !o.conflicting &&
      date(o.as_of) <= date(o.observed_at) && o.observed_at <= r.as_of && r.as_of < date(o.expires_at),'OBSERVATION');
  }
  check(q.quote_expiry === Object.values(snap).map(o=>o.expires_at).sort()[0] &&
    q.fx_rate === snap.fx[snap.fx.selected] && q.peg_reference === snap.peg[snap.peg.selected] &&
    q.assumed_unit_price_jpy === snap.price[snap.price.selected] &&
    q.eligible_quantity === (i.quantity_override ?? a.quantity) &&
    q.fx_principal_jpy === q.reference_value_jpy.split('.')[0] &&
    /^(0|[1-9]\d{0,4})$/.test(i.fee_bps) && BigInt(i.fee_bps) <= 10000n,'QUOTE_BINDING');
  const exact = scaled(q.eligible_quantity,18,12) * scaled(q.assumed_unit_price_jpy,6,9);
  const peg = scaled(q.peg_reference,4,9);
  check(exact === scaled(q.reference_value_jpy,24,12) && scaled(q.fx_rate,4,9) > 0n &&
    scaled(q.assumed_unit_price_jpy,6,9) > 0n && peg >= 9500n && peg <= 10500n &&
    q.quantity_basis === (i.quantity_override === null ? 'SOURCE_ESTIMATE' : 'SCENARIO_OVERRIDE') &&
    q.price_source === snap.price.source && q.price_as_of === snap.price.as_of &&
    q.price_observed_at === snap.price.observed_at && q.fx_source === snap.fx.source &&
    q.fx_timestamp === snap.fx.as_of && q.peg_source === snap.peg.source &&
    q.peg_timestamp === snap.peg.as_of,'VALUATION_REPLAY');
  const amounts = settlementReference(q.fx_principal_jpy,{quote:q,fee_bps:i.fee_bps,receipt_sha256});
  check(amounts.execution_usd === q.reference_value_usd &&
    ['gross_amount','estimated_fee','net_amount'].every(k=>amounts[k]===q[k]),'SETTLEMENT_REPLAY');
}
export function runValuationBook(scenario,bindings,histories,at = new Date().toISOString()) {
  date(at);
  check(Array.isArray(bindings) && bindings.length > 0 && bindings.length <= 256 &&
    Array.isArray(histories) && histories.length === bindings.length,'BOOK_SIZE');
  const terms = new Map(), provenance = new Set(), sourcePins = new Set();
  for (const [i,b] of bindings.entries()) {
    const chain = histories[i];
    check(Array.isArray(chain) && chain.length > 0 && chain.length <= 1024 &&
      Buffer.byteLength(JSON.stringify(chain)) <= 8*1024*1024,'HISTORY_SIZE');
    check(!terms.has(b.serial) && scenario.registry.entries.some(e=>e.serial===b.serial),'SERIAL_BINDING');
    const root = chain[0].input.asset.evidence_package_sha256;
    check(root === b.initial_evidence_package_sha256,'EVIDENCE_PIN');
    sourcePins.add(root);
    let prev = null;
    for (const r of chain) {
      inspect(r);
      check(r.input.asset.asset_id === b.asset_id && r.input.valuation_scenario_id === b.valuation_scenario_id &&
        r.previous_receipt_sha256 === (prev?.receipt_sha256 ?? null) &&
        (!prev || prev.as_of <= r.as_of),'LINEAGE');
      prev = r;
    }
    check(prev.receipt_sha256 === b.current_receipt_sha256 && prev.as_of <= at,'CURRENT_HEAD_PIN_OR_TIME');
    for (const id of new Set([root,prev.input.asset.evidence_package_sha256,'asset:' + b.asset_id])) {
      check(!provenance.has(id),'DOUBLE_EVIDENCE'); provenance.add(id);
    }
    const state = prev.status === 'BLOCKED' ? 'SUSPENDED_REVERIFICATION' :
      at >= prev.quote.quote_expiry ? 'SUSPENDED_EXPIRED' : 'OPEN_SIMULATION';
    terms.set(b.serial,{state,receipt_sha256:prev.receipt_sha256,fee_bps:prev.input.fee_bps,quote:prev.quote});
  }
  check(sourcePins.has(scenario.source.evidence_package_sha256),'SCENARIO_SOURCE_BINDING');
  return {schema:'nftm-valuation-book/1',mode:'SIMULATION_ONLY',as_of:at,
    listings:[...terms].map(([serial,t])=>({serial,...t})),
    orders:structuredClone(scenario.orders),simulated_market:runMarketScenario(scenario,terms),
    real_rights_verified:false,credits_created_from_mrv:0};
}
