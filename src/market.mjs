/**
 * Natural Fungible Token Market — independent synthetic-only simulation.
 * No code is copied from NaFT. No real rights, tokens, payment rails, or
 * carbon-credit issuance/transfer/retirement are connected or authorized.
 */
import {createHash} from 'node:crypto';

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function requireValue(condition, code) {
  if (!condition) throw new Error(`NFTM_BLOCKED:${code}`);
}
function exactKeys(value, expected, code) {
  requireValue(isObject(value), code);
  requireValue(Object.keys(value).every(k => expected.includes(k)), code);
  requireValue(expected.every(k => Object.hasOwn(value, k)), code);
}
function positiveJPY(v) {
  requireValue(typeof v === 'string' && /^[1-9][0-9]{0,11}$/.test(v), 'INVALID_JPY');
  return BigInt(v);
}
function fixed4(v, code) {
  requireValue(typeof v === 'string' && /^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,4})?$/.test(v), code);
  const [whole, fractional=''] = v.split('.');
  const units = BigInt(whole) * 10000n + BigInt((fractional + '0000').slice(0,4));
  requireValue(units > 0n, code);
  return units;
}
function microToDecimal(value) {
  const prefix = (value / 1000000n).toString();
  const decimal = (value % 1000000n).toString().padStart(6,'0').replace(/0+$/, '');
  return decimal ? `${prefix}.${decimal}` : prefix;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
/**
 * Whole JPY -> MICRO units of a wholly synthetic, USD-pegged reference unit.
 * Rate and peg are user-provided assumptions, not executable offers or FX data.
 * Floor-rounding is explicit and deterministic.
 */
export function quoteSimulatedStableUnits(priceJPY, jpyPerUSD, usdPerUnit) {
  const amount = positiveJPY(priceJPY);
  const rate = fixed4(jpyPerUSD, 'INVALID_FX_ASSUMPTION');
  const peg = fixed4(usdPerUnit, 'INVALID_PEG_ASSUMPTION');
  return microToDecimal(amount * 100000000000000n / (rate * peg));
}

export function runMarketScenario(input) {
  requireValue(isObject(input) && JSON.stringify(input).length <= 200000, 'INVALID_SCENARIO');
  exactKeys(input, ['schema','source','market','registry','fx','orders','retire_after_match'], 'SCENARIO_FIELDS');
  requireValue(input.schema === 'nftm-synthetic-market/1', 'UNKNOWN_SCHEMA');

  exactKeys(input.source, ['naft_repository','evidence_package_sha256','verification_status','formal_certification'], 'SOURCE_FIELDS');
  requireValue(input.source.naft_repository === 'Takzin1/NaFT' &&
    /^[0-9a-f]{64}$/.test(input.source.evidence_package_sha256) &&
    input.source.verification_status === 'RESEARCH_ONLY' &&
    input.source.formal_certification === false, 'RESEARCH_SOURCE_REQUIRED');

  exactKeys(input.market, ['id','real_orders_enabled','real_payments_enabled'], 'MARKET_FIELDS');
  requireValue(input.market.id === 'NFTM-SIMULATION-ONLY' &&
    input.market.real_orders_enabled === false && input.market.real_payments_enabled === false,
    'PRODUCTION_MARKET_FORBIDDEN');

  exactKeys(input.registry, ['id','entries'], 'REGISTRY_FIELDS');
  requireValue(input.registry.id === 'NFTM-SYNTHETIC-REGISTRY' &&
    Array.isArray(input.registry.entries) && input.registry.entries.length <= 256, 'SYNTHETIC_REGISTRY_ONLY');
  const registry = new Map();
  for (const entry of input.registry.entries) {
    exactKeys(entry,['serial','state','custody','duplicate_claim'], 'ENTRY_FIELDS');
    requireValue(typeof entry.serial === 'string' && /^SYN-[A-Z0-9-]{1,70}$/.test(entry.serial), 'SYNTHETIC_SERIAL_ONLY');
    requireValue(!registry.has(entry.serial), 'DUPLICATE_REGISTRY_SERIAL');
    requireValue(['MOCK_ISSUED','MOCK_RETIRED','MOCK_REVOKED'].includes(entry.state), 'UNKNOWN_MOCK_STATE');
    requireValue(['MOCK_LOCKED','MOCK_UNLOCKED'].includes(entry.custody) &&
      typeof entry.duplicate_claim === 'boolean', 'INVALID_CUSTODY_OR_CLAIM');
    registry.set(entry.serial, entry);
  }

  exactKeys(input.fx,['source','jpy_per_usd','usd_per_simulated_unit'], 'FX_FIELDS');
  requireValue(input.fx.source === 'USER_ASSUMPTION_NOT_MARKET_DATA', 'LIVE_FX_NOT_SUPPORTED');
  fixed4(input.fx.jpy_per_usd, 'INVALID_FX_ASSUMPTION');
  fixed4(input.fx.usd_per_simulated_unit, 'INVALID_PEG_ASSUMPTION');

  requireValue(Array.isArray(input.orders) && input.orders.length <= 256, 'ORDERS_LIMIT');
  const seenOrderIds = new Set();
  const validSells = new Map();
  const validBuys = new Map();
  const blockedOrders = [];
  const pendingOrders = [];
  for (const [sequence, order] of input.orders.entries()) {
    exactKeys(order,['id','side','serial','limit_price_jpy','quantity'], 'ORDER_FIELDS');
    requireValue(typeof order.id === 'string' && /^ORD-[A-Z0-9-]{1,70}$/.test(order.id) && !seenOrderIds.has(order.id), 'DUPLICATE_OR_INVALID_ORDER_ID');
    seenOrderIds.add(order.id);
    requireValue(['BUY','SELL'].includes(order.side) && order.quantity === 1 &&
      typeof order.serial === 'string', 'INVALID_ORDER');
    const price = positiveJPY(order.limit_price_jpy);
    const asset = registry.get(order.serial);
    const authorizedSynthetic = asset?.state === 'MOCK_ISSUED' &&
      asset?.custody === 'MOCK_LOCKED' && asset?.duplicate_claim === false;
    if (!authorizedSynthetic) {
      blockedOrders.push({order_id:order.id, reason:'SYNTHETIC_REGISTRY_GATE_FAILED'});
      continue;
    }
    const prepared = {...order, sequence, price};
    if (order.side === 'SELL') {
      if (validSells.has(order.serial)) {
        blockedOrders.push({order_id:order.id, reason:'ONE_SELL_PER_SYNTHETIC_SERIAL'});
      } else validSells.set(order.serial,prepared);
    } else {
      const bids = validBuys.get(order.serial) ?? [];
      bids.push(prepared);
      validBuys.set(order.serial,bids);
    }
  }

  const matches = [];
  for (const [serial, sell] of validSells) {
    const bids = (validBuys.get(serial) ?? []).sort((a,b) =>
      a.price === b.price ? a.sequence-b.sequence : (a.price > b.price ? -1 : 1));
    const buyer = bids.find(b => b.price >= sell.price);
    if (!buyer) {pendingOrders.push(sell.id);continue;}
    const stableUnits = quoteSimulatedStableUnits(
      sell.limit_price_jpy, input.fx.jpy_per_usd, input.fx.usd_per_simulated_unit);
    matches.push({
      serial, sell_order_id:sell.id, buy_order_id:buyer.id,
      execution_price_jpy:sell.limit_price_jpy,
      simulated_stable_units:stableUnits, settlement_status:'SIMULATED_NO_PAYMENT'
    });
  }
  matches.sort((a,b)=>a.serial.localeCompare(b.serial));
  requireValue(Array.isArray(input.retire_after_match) && input.retire_after_match.length <= 256,
    'RETIRE_REQUESTS_LIMIT');
  const retired = new Set();
  const mockRetirement = [];
  for (const serial of input.retire_after_match) {
    requireValue(typeof serial === 'string' && !retired.has(serial), 'DUPLICATE_RETIRE_REQUEST');
    retired.add(serial);
    mockRetirement.push({serial, status:matches.some(m=>m.serial===serial)
      ? 'SIMULATED_RETIRED_ONLY' : 'BLOCKED_NO_MATCH'});
  }
  const output = {
    schema:'nftm-synthetic-market-result/1',
    source_package_sha256:input.source.evidence_package_sha256,
    market_id:input.market.id,
    order_count:input.orders.length,
    matches, blocked_orders:blockedOrders, unmatched_sell_orders:pendingOrders,
    simulated_retirements:mockRetirement,
    real_ownership_verified:false,
    real_carbon_credits_traded:0,
    real_stablecoin_transferred:false,
    onchain_transactions_submitted:false,
    production_mint_authorized:false,
    warnings:['RESEARCH_INPUT_IS_NOT_A_CERTIFIED_CARBON_CREDIT',
      'SIMULATED_REGISTRY_IS_NOT_A_REAL_RIGHTS_REGISTRY',
      'FX_AND_PEG_VALUES_ARE_ASSUMPTIONS_NOT_LIVE_QUOTES']
  };
  return {...output, receipt_sha256:digest(output)};
}
