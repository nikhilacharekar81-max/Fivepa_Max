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
