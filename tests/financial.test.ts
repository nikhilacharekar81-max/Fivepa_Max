import test from 'node:test';
import assert from 'node:assert';
import { calculateOrderFees, DEFAULT_FEE_CONFIG } from '../server/domains/finance/fees.ts';
import { assertValidMoneyAmount } from '../server/domains/finance/financial.service.ts';

test('Authoritative fee calculations match policy', () => {
  const fees = calculateOrderFees(100, DEFAULT_FEE_CONFIG);
  assert.strictEqual(fees.gigPrice, 100);
  assert.strictEqual(fees.platformCommission, 20);
  assert.strictEqual(fees.freelancerNet, 80);
  assert.strictEqual(fees.serviceFee, 1);
  assert.strictEqual(fees.smallOrderFee, 1);
  assert.strictEqual(fees.clientTotal, 102);
});

test('Money amount validation rejects negative and excess precision', () => {
  assert.strictEqual(assertValidMoneyAmount(50.50), 50.50);
  assert.throws(() => assertValidMoneyAmount(-10), /cannot be negative|must be greater than zero/);
  assert.throws(() => assertValidMoneyAmount(10.999), /excess decimal precision/);
});

test('Exact cents comparison matches expected checkout session amount', () => {
  const sessExpected = 100.05;
  const webhookActual = 100.05;
  assert.strictEqual(Math.round(sessExpected * 100), Math.round(webhookActual * 100));

  const webhookTampered = 100.06;
  assert.notStrictEqual(Math.round(sessExpected * 100), Math.round(webhookTampered * 100));
});

test('Fee policy calculations for small order (< $200) vs large order (>= $200)', () => {
  // Small order: $50 gig price -> 20% commission ($10), 1% buyer fee ($0.50), $1.00 small order fee -> clientTotal = $51.50
  const smallFees = calculateOrderFees(50, DEFAULT_FEE_CONFIG);
  assert.strictEqual(smallFees.gigPrice, 50);
  assert.strictEqual(smallFees.platformCommission, 10);
  assert.strictEqual(smallFees.freelancerNet, 40);
  assert.strictEqual(smallFees.serviceFee, 0.5);
  assert.strictEqual(smallFees.smallOrderFee, 1);
  assert.strictEqual(smallFees.clientTotal, 51.5);

  // Large order: $300 gig price -> 20% commission ($60), 1% buyer fee ($3), NO small order fee ($0) -> clientTotal = $303
  const largeFees = calculateOrderFees(300, DEFAULT_FEE_CONFIG);
  assert.strictEqual(largeFees.gigPrice, 300);
  assert.strictEqual(largeFees.platformCommission, 60);
  assert.strictEqual(largeFees.freelancerNet, 240);
  assert.strictEqual(largeFees.serviceFee, 3);
  assert.strictEqual(largeFees.smallOrderFee, 0);
  assert.strictEqual(largeFees.clientTotal, 303);
});

