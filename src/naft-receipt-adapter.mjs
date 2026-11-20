/**
 * NFTM read-only intake for NaFT Core's published Blue Carbon bridge receipt v1.
 * Independently authored schema checks; no upstream source code is vendored.
 * Cryptographic hashes assert internal consistency and the explicit caller pin,
 * NOT verified environmental measurements, legal rights, or registry ownership.
 */
import {createHash} from 'node:crypto';
import {runMarketScenario} from './market.mjs';

const HEX64 = /^[0-9a-f]{64}$/;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function fail(code) { throw new Error(`NFTM_BRIDGE_BLOCKED:${code}`); }
function check(ok, code) { if (!ok) fail(code); }
function fields(x, required, code) {
  check(isObject(x) && Object.keys(x).length === required.length &&
    required.every(k => Object.hasOwn(x, k)), code);
}
function canonical(x) {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (isObject(x)) return `{${Object.keys(x).sort().map(k =>
    `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
function hash(x) { return createHash('sha256').update(canonical(x)).digest('hex'); }
function text(x, max = 200) { return typeof x === 'string' && x.length > 0 && x.length <= max; }
function finiteNonnegative(x) { return typeof x === 'number' && Number.isFinite(x) && x >= 0; }

/**
 * Validate NaFT bridge receipt against an independently pinned receipt hash.
 * The pin is mandatory: a self-signed JSON digest alone cannot establish origin.
 * Never transforms the supplied research estimates into a simulated registry unit.
 */
export function inspectNaftReceipt(receipt, expectedReceiptHash) {
  check(isObject(receipt) && Buffer.byteLength(JSON.stringify(receipt)) <= 1024 * 1024,
    'RECEIPT_SIZE_OR_TYPE');
  const required = ['schema', 'edition', 'source_repository', 'source_schema',
    'source_package_hash', 'project_id', 'methodology', 'claim_count', 'claims',
    'total_research_estimate_tco2e', 'replay', 'scientific_validation',
    'evidence_origin_verified', 'formal_certification', 'certified_tco2e',
    'issued_credits', 'web3_anchor_status', 'warning', 'receipt_hash'];
  fields(receipt, required, 'RECEIPT_FIELDS');
  check(receipt.schema === 'naft-edition-bridge-receipt/1' &&
    receipt.edition === 'BLUE_CARBON' &&
    receipt.source_repository === 'Takzin1/NaFT_BlueCarbon_MRV_Edition' &&
    receipt.source_schema === '0.3.0', 'UPSTREAM_SCHEMA');
  check(HEX64.test(expectedReceiptHash ?? '') &&
    HEX64.test(receipt.receipt_hash ?? '') &&
    receipt.receipt_hash === expectedReceiptHash, 'RECEIPT_PIN_MISMATCH');
  const {receipt_hash, ...body} = receipt;
  check(hash(body) === receipt_hash, 'RECEIPT_DIGEST_MISMATCH');
  check(HEX64.test(receipt.source_package_hash ?? '') && text(receipt.project_id), 'SOURCE_BINDING');
  fields(receipt.methodology, ['id','version','status'], 'METHOD_FIELDS');
  check(['NAFT-RESEARCH@0.1.0', 'JBLUE-REFERENCE@2.6', 'VM0033-REFERENCE@2.1'].includes(
    `${receipt.methodology.id}@${receipt.methodology.version}`) &&
    receipt.methodology.status === 'RESEARCH_REFERENCE_ONLY', 'METHOD_BOUNDARY');
  fields(receipt.replay, ['source_fingerprints','research_arithmetic','monitoring_arithmetic','package_hash'],
    'REPLAY_FIELDS');
  check(Object.values(receipt.replay).every(v => v === 'MATCH'), 'REPLAY_NOT_VERIFIED');
  check(receipt.scientific_validation === false && receipt.evidence_origin_verified === false &&
    receipt.formal_certification === false && receipt.certified_tco2e === null &&
    receipt.issued_credits === null && receipt.web3_anchor_status === 'NOT_SUBMITTED',
    'CERTIFICATION_OR_RIGHTS_BOUNDARY');
  check(text(receipt.warning, 2000) && Array.isArray(receipt.claims) &&
    receipt.claims.length > 0 && receipt.claims.length <= 500 &&
    receipt.claim_count === receipt.claims.length &&
    finiteNonnegative(receipt.total_research_estimate_tco2e), 'CLAIMS_BOUNDARY');
  const ids = new Set();
  for (const claim of receipt.claims) {
    fields(claim, ['claim_id','habitat','fingerprint','readiness',
      'research_estimate_tco2e','evidence_ids','observation_rows'], 'CLAIM_FIELDS');
    check(text(claim.claim_id) && text(claim.habitat) &&
      HEX64.test(claim.fingerprint ?? '') &&
      ['RESEARCH_ESTIMATE','EVIDENCE_GAPS'].includes(claim.readiness) &&
      finiteNonnegative(claim.research_estimate_tco2e) &&
      Number.isSafeInteger(claim.observation_rows) && claim.observation_rows >= 0 &&
      Array.isArray(claim.evidence_ids) && claim.evidence_ids.length <= 500 &&
      claim.evidence_ids.every(id => text(id)) &&
      new Set(claim.evidence_ids).size === claim.evidence_ids.length &&
      !ids.has(claim.claim_id), 'CLAIM_INVALID');
    ids.add(claim.claim_id);
  }
  // The upstream independently replays calculations; NFTM only consumes the
  // research receipt. We do not re-issue scientific/registry certifications.
  return Object.freeze({
    receipt_schema:receipt.schema, source_repository:receipt.source_repository,
    source_package_sha256:receipt.source_package_hash, receipt_sha256:receipt_hash,
    project_id:receipt.project_id, methodology_reference:
      `${receipt.methodology.id}@${receipt.methodology.version}`,
    claim_count:receipt.claim_count, evidence_gaps:
      receipt.claims.filter(c=>c.readiness === 'EVIDENCE_GAPS').length,
    research_estimate_tco2e:receipt.total_research_estimate_tco2e,
    scientific_validation:false, formal_certification:false,
    issued_carbon_credits:0, rights_verified:false
  });
}

/**
 * Bind a validated NaFT receipt to the existing *independent synthetic* market.
 * The market's SYN-* mock serials must be declared separately. Scientific
 * research estimates NEVER populate that registry or create orders.
 */
export function connectNaftToMockMarket(receipt, scenario, expectedReceiptHash) {
  const provenance = inspectNaftReceipt(receipt, expectedReceiptHash);
  check(isObject(scenario) && isObject(scenario.source) &&
    scenario.source.evidence_package_sha256 === provenance.source_package_sha256 &&
    scenario.source.naft_repository === 'Takzin1/NaFT' &&
    scenario.source.formal_certification === false &&
    scenario.source.verification_status === 'RESEARCH_ONLY', 'SCENARIO_PIN_MISMATCH');
  const simulation = runMarketScenario(scenario);
  return {
    schema:'nftm-naft-readonly-connection/1',
    connection:'OFFLINE_RECEIPT_BOUND_READ_ONLY',
    provenance,
    simulated_market:simulation,
    registry_rights_established:false,
    credits_created_from_mrv:0,
    transactions_submitted:0,
    warning:'Research receipt binding only; market trades unrelated synthetic registry entries, not NaFT estimates.'
  };
}
