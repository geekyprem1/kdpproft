/**
 * Book Opportunity Engine validation suite.
 *
 *   npm run test:opportunity
 *
 * Covers: scoring formula, competition inversion, determinism, band thresholds,
 * factor labels.
 */

import assert from "node:assert/strict";
import {
  computeOpportunity,
  opportunityBand,
  factorLabel,
} from "../lib/opportunity";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("── Opportunity Engine suite ────────────────────");

test("formula: all-best → 100, all-worst → 0", () => {
  assert.equal(computeOpportunity({ demand: 100, competition: 0, evergreen: 100, monetization: 100 }), 100);
  assert.equal(computeOpportunity({ demand: 0, competition: 100, evergreen: 0, monetization: 0 }), 0);
});

test("formula: weighted mid case", () => {
  // 0.30*80 + 0.25*(100-40) + 0.15*60 + 0.30*70 = 24 + 15 + 9 + 21 = 69
  assert.equal(computeOpportunity({ demand: 80, competition: 40, evergreen: 60, monetization: 70 }), 69);
});

test("competition is inverted (more competition → lower score)", () => {
  const base = { demand: 70, evergreen: 70, monetization: 70 };
  const low = computeOpportunity({ ...base, competition: 10 });
  const high = computeOpportunity({ ...base, competition: 90 });
  assert.ok(low > high, `expected low-competition score > high (${low} vs ${high})`);
});

test("deterministic: same factors → same score", () => {
  const f = { demand: 55, competition: 33, evergreen: 77, monetization: 44 };
  assert.equal(computeOpportunity(f), computeOpportunity({ ...f }));
});

test("bands at thresholds", () => {
  assert.equal(opportunityBand(80), "Excellent");
  assert.equal(opportunityBand(79), "High");
  assert.equal(opportunityBand(60), "High");
  assert.equal(opportunityBand(59), "Medium");
  assert.equal(opportunityBand(40), "Medium");
  assert.equal(opportunityBand(39), "Low");
});

test("factor labels", () => {
  assert.equal(factorLabel(67), "High");
  assert.equal(factorLabel(66), "Medium");
  assert.equal(factorLabel(34), "Medium");
  assert.equal(factorLabel(33), "Low");
});

console.log("────────────────────────────────────────────────");
console.log(`✓ ALL ${passed} OPPORTUNITY TESTS PASSED`);
