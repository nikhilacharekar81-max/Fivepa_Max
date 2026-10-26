import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresStore } from '../server/db/postgresStore.js';
import {
  financialTransactionService,
  financialRepository,
  assertValidMoneyAmount,
  checkOrRecordIdempotency,
  recordIdempotencyResult,
  encryptSecret,
  decryptSecret,
  paymentGatewayManager,
  calculateDifferentialFees,
  DEFAULT_FEE_CONFIG
} from '../server/domains/finance/index.js';
import { store } from '../server/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function getFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === 'dist' || file === '.git' || file === 'brain') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, extensions));
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

test('Finance Vault Invariant 1: Direct Financial Table Mutation Lockout', async () => {
  const allFiles = getFiles(path.join(ROOT, 'server'), ['.ts', '.tsx'])
    .concat(getFiles(path.join(ROOT, 'src'), ['.ts', '.tsx']));

  const financialTables = [
    'wallets',
    'wallet_movements',
    'escrows',
    'payouts',
    'refunds',
    'ledger_journals',
    'ledger_entries',
    'earnings_clearing',
    'financial_idempotency'
  ];

  const sqlPattern = new RegExp(
    `(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(${financialTables.join('|')})\\b`,
    'i'
  );

  const violations: string[] = [];
  for (const file of allFiles) {
    const normalized = file.replace(/\\/g, '/');
    if (
      normalized.includes('/server/domains/finance/') ||
      normalized.endsWith('/server/db/postgresStore.ts') ||
      normalized.endsWith('/server/db/migration.sql') ||
      normalized.endsWith('migration.sql')
    ) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(sqlPattern);
    if (match) {
      violations.push(`${path.relative(ROOT, file)}: matched prohibited SQL "${match[0]}"`);
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `Direct SQL mutations on financial tables found outside finance domain:\n${violations.join('\n')}`
  );
});

test('Finance Vault Invariant 2: financeLedger Direct Import Lockout', async () => {
  const scanDirs = [
    path.join(ROOT, 'server', 'routes'),
    path.join(ROOT, 'server', 'services'),
    path.join(ROOT, 'server', 'domains')
  ];

  const files = scanDirs.flatMap(dir => getFiles(dir, ['.ts']));
  const violations: string[] = [];

  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    if (normalized.includes('/server/domains/finance/')) continue;
    // Permitted thin re-export files
    if (
      normalized.endsWith('/server/services/financeLedger.ts') ||
      normalized.endsWith('/server/services/financialService.ts')
    ) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('financeLedger')) {
      violations.push(`${path.relative(ROOT, file)} imports or references financeLedger directly`);
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `Prohibited financeLedger direct imports found:\n${violations.join('\n')}`
  );
});

test('Finance Vault Invariant 3: Request-Fingerprinted Idempotency Conflict Detection', async () => {
  await postgresStore.runMigrations();

  const testKey = `test_idemp_key_${Date.now()}`;
  const op = 'testOperation';
  const originalPayload = { orderId: 'ord_vault_idemp_1', amount: 100, currency: 'USD' };

  // First execution: not replayed
  const check1 = await postgresStore.executeInTransaction(async (client) => {
    return checkOrRecordIdempotency(client, testKey, op, originalPayload);
  });
  assert.strictEqual(check1.replayed, false, 'First attempt must not be marked replayed');

  // Record result
  await postgresStore.executeInTransaction(async (client) => {
    await recordIdempotencyResult(client, testKey, op, { status: 'success', balance: 100 }, originalPayload);
  });

  // Replay with identical payload: returns cached result
  const check2 = await postgresStore.executeInTransaction(async (client) => {
    return checkOrRecordIdempotency(client, testKey, op, originalPayload);
  });
  assert.strictEqual(check2.replayed, true, 'Replay with identical fingerprint must return replayed=true');
  assert.deepStrictEqual(check2.result, { status: 'success', balance: 100 }, 'Replay must return stored result');

  // Conflict: same key, differing payload
  const conflictingPayload = { orderId: 'ord_vault_idemp_1', amount: 250, currency: 'USD' };
  await assert.rejects(
    async () => {
      await postgresStore.executeInTransaction(async (client) => {
        return checkOrRecordIdempotency(client, testKey, op, conflictingPayload);
      });
    },
    /Idempotency.*conflict|mismatch/i,
    'Conflicting payload on existing idempotency key must reject with conflict error'
  );
});

test('Finance Vault Invariant 4: No Double Escrow Overwrite & Dynamic Differential Top-Up', async () => {
  await postgresStore.runMigrations();

  const buyerId = `u_buyer_vault_4_${Date.now()}`;
  const sellerId = `u_seller_vault_4_${Date.now()}`;
  const orderId = `ord_vault_topup_${Date.now()}`;

  await store.saveUser({
    id: buyerId,
    email: `${buyerId}@example.com`,
    name: 'Buyer Four',
    role: 'buyer',
    status: 'active'
  } as any);

  await store.saveUser({
    id: sellerId,
    email: `${sellerId}@example.com`,
    name: 'Seller Four',
    role: 'freelancer',
    status: 'active'
  } as any);

  await financialTransactionService.ensureWallet({ userId: buyerId, role: 'buyer', name: 'Buyer Four' });
  await financialTransactionService.ensureWallet({ userId: sellerId, role: 'freelancer', name: 'Seller Four' });

  // Deposit funds to buyer
  await financialTransactionService.creditDeposit({
    userId: buyerId,
    amount: 500,
    reference: 'DEP-VAULT-4',
    idempotencyKey: `idemp_dep_v4_${Date.now()}`,
    actor: 'test'
  });

  // Save base order
  await store.saveOrder({
    id: orderId,
    title: 'Vault TopUp Order',
    buyerId,
    sellerId,
    amount: 50,
    status: 'pending',
    createdAt: new Date().toISOString(),
    dueDate: new Date().toISOString()
  } as any);

  // Fund escrow: $50
  const fundRes = await financialTransactionService.fundEscrow({
    orderId,
    orderTitle: 'Vault TopUp Order',
    amount: 50,
    buyerId,
    sellerId,
    actor: 'test',
    idempotencyKey: `idemp_fund_v4_${Date.now()}`
  });
  assert.strictEqual(fundRes.success, true);

  // Attempt double funding on same order with NEW idempotency key -> MUST throw
  await assert.rejects(
    async () => {
      await financialTransactionService.fundEscrow({
        orderId,
        orderTitle: 'Vault TopUp Order Second Fund Attempt',
        amount: 50,
        buyerId,
        sellerId,
        actor: 'test',
        idempotencyKey: `idemp_fund_second_${Date.now()}`
      });
    },
    /already funded/i,
    'Double funding an already funded escrow must throw'
  );

  // Top-Up Escrow: Add $10 (previous: $50, next: $60)
  const topUpRes = await financialTransactionService.topUpEscrow({
    orderId,
    orderTitle: 'Vault TopUp Order',
    amount: 10,
    buyerId,
    sellerId,
    actor: 'test',
    idempotencyKey: `idemp_topup_v4_${Date.now()}`
  });
  assert.strictEqual(topUpRes.success, true);

  // Verify dynamic differential calculation:
  // previous $50: buyer fee 1% ($0.50), small order fee $1.00 -> total fee $1.50
  // next $60: buyer fee 1% ($0.60), small order fee $1.00 -> total fee $1.60
  // differential fee: $0.10
  const expectedDiff = calculateDifferentialFees(50, 60);
  assert.strictEqual(topUpRes.diff.additionalServiceFee, expectedDiff.additionalServiceFee);
  assert.strictEqual(topUpRes.diff.additionalSmallOrderFee, expectedDiff.additionalSmallOrderFee);
  assert.strictEqual(topUpRes.diff.additionalClientTotal, expectedDiff.additionalClientTotal);

  // Check escrow table
  const escRow = await postgresStore.getPool().query('SELECT * FROM escrows WHERE order_id = $1', [orderId]);
  assert.strictEqual(Number(escRow.rows[0].amount), 60);
  assert.strictEqual(Number(escRow.rows[0].remaining), 60);
});

test('Finance Vault Invariant 5: Full Refund Revenue Account Reversal (4020 & 4030)', async () => {
  await postgresStore.runMigrations();

  const buyerId = `u_buyer_vault_5_${Date.now()}`;
  const sellerId = `u_seller_vault_5_${Date.now()}`;
  const orderId = `ord_vault_ref_${Date.now()}`;

  await store.saveUser({
    id: buyerId,
    email: `${buyerId}@example.com`,
    name: 'Buyer Five',
    role: 'buyer',
    status: 'active'
  } as any);

  await store.saveUser({
    id: sellerId,
    email: `${sellerId}@example.com`,
    name: 'Seller Five',
    role: 'freelancer',
    status: 'active'
  } as any);

  await financialTransactionService.ensureWallet({ userId: buyerId, role: 'buyer', name: 'Buyer Five' });
  await financialTransactionService.ensureWallet({ userId: sellerId, role: 'freelancer', name: 'Seller Five' });

  // Deposit funds
  await financialTransactionService.creditDeposit({
    userId: buyerId,
    amount: 200,
    reference: 'DEP-VAULT-5',
    idempotencyKey: `idemp_dep_v5_${Date.now()}`,
    actor: 'test'
  });

  await store.saveOrder({
    id: orderId,
    title: 'Vault Refund Order',
    buyerId,
    sellerId,
    amount: 100,
    status: 'pending',
    createdAt: new Date().toISOString(),
    dueDate: new Date().toISOString()
  } as any);

  // Fund escrow: $100 (< $200, so $1 service fee + $1 small order fee)
  await financialTransactionService.fundEscrow({
    orderId,
    orderTitle: 'Vault Refund Order',
    amount: 100,
    buyerId,
    sellerId,
    actor: 'test',
    idempotencyKey: `idemp_fund_v5_${Date.now()}`
  });

  // Full Refund
  const refRes = await financialTransactionService.refundOrderFunds({
    orderId,
    reason: 'Buyer cancellation',
    actor: 'admin',
    idempotencyKey: `idemp_ref_v5_${Date.now()}`
  });
  assert.strictEqual(refRes.success, true);
  assert.strictEqual(refRes.refunded, 100);
  assert.strictEqual(refRes.feesRefunded, 2); // $1 service fee + $1 small order fee

  // Verify revenue accounts 4020 and 4030 net to $0.00 for this order
  const entriesRes = await postgresStore.getPool().query(
    'SELECT account_code, SUM(debit) as deb, SUM(credit) as cred FROM ledger_entries WHERE order_id = $1 GROUP BY account_code',
    [orderId]
  );

  const accMap = new Map<string, { deb: number; cred: number }>();
  for (const row of entriesRes.rows) {
    accMap.set(row.account_code, { deb: Number(row.deb), cred: Number(row.cred) });
  }

  // Account 4020 (Platform Service Fee): credited $1 on fund, debited $1 on full refund
  const a4020 = accMap.get('4020');
  assert.ok(a4020, 'Account 4020 entries must exist');
  assert.strictEqual(a4020.deb, a4020.cred, 'Account 4020 debits must equal credits (net $0)');

  // Account 4030 (Small Order Fee): credited $1 on fund, debited $1 on full refund
  const a4030 = accMap.get('4030');
  assert.ok(a4030, 'Account 4030 entries must exist');
  assert.strictEqual(a4030.deb, a4030.cred, 'Account 4030 debits must equal credits (net $0)');

  // Authoritative refunds table has processed refund
  const refundRows = await postgresStore.getPool().query('SELECT * FROM refunds WHERE order_id = $1', [orderId]);
  assert.strictEqual(refundRows.rows.length, 1, 'Exactly one row in refunds table');
  assert.strictEqual(Number(refundRows.rows[0].amount), 100);
});

test('Finance Vault Invariant 6: Single Clearing Table & Zero Double-Increment on Replay', async () => {
  await postgresStore.runMigrations();

  const buyerId = `u_buyer_vault_6_${Date.now()}`;
  const sellerId = `u_seller_vault_6_${Date.now()}`;
  const orderId = `ord_vault_rel_${Date.now()}`;

  await store.saveUser({
    id: buyerId,
    email: `${buyerId}@example.com`,
    name: 'Buyer Six',
    role: 'buyer',
    status: 'active'
  } as any);

  await store.saveUser({
    id: sellerId,
    email: `${sellerId}@example.com`,
    name: 'Seller Six',
    role: 'freelancer',
    status: 'active',
    earned: 0,
    completedJobs: 0
  } as any);

  await financialTransactionService.ensureWallet({ userId: buyerId, role: 'buyer', name: 'Buyer Six' });
  await financialTransactionService.ensureWallet({ userId: sellerId, role: 'freelancer', name: 'Seller Six' });

  await financialTransactionService.creditDeposit({
    userId: buyerId,
    amount: 300,
    reference: 'DEP-VAULT-6',
    idempotencyKey: `idemp_dep_v6_${Date.now()}`,
    actor: 'test'
  });

  await store.saveOrder({
    id: orderId,
    title: 'Vault Release Order',
    buyerId,
    sellerId,
    amount: 100,
    status: 'pending',
    createdAt: new Date().toISOString(),
    dueDate: new Date().toISOString()
  } as any);

  await financialTransactionService.fundEscrow({
    orderId,
    orderTitle: 'Vault Release Order',
    amount: 100,
    buyerId,
    sellerId,
    actor: 'test',
    idempotencyKey: `idemp_fund_v6_${Date.now()}`
  });

  const replayKey = `idemp_rel_replay_${Date.now()}`;

  // Release order funds (first time)
  const rel1 = await financialTransactionService.releaseOrderFunds({
    orderId,
    actor: 'test',
    idempotencyKey: replayKey
  });
  assert.strictEqual(rel1.success, true);
  assert.strictEqual(rel1.freelancerNet, 80); // $100 - 20% platform commission = $80

  // Inspect earnings_clearing table (single authoritative clearing table)
  const clr1 = await postgresStore.getPool().query('SELECT * FROM earnings_clearing WHERE order_id = $1', [orderId]);
  assert.strictEqual(clr1.rows.length, 1, 'Must have exactly 1 row in earnings_clearing');
  assert.strictEqual(Number(clr1.rows[0].amount), 80);

  // Inspect user stats after first release
  const user1 = await store.getUser(sellerId);
  assert.strictEqual(user1?.completedJobs, 1, 'Seller completedJobs must be 1');
  assert.strictEqual(user1?.earned, 80, 'Seller earned must be $80.00');

  // Replay release order funds with exact same idempotency key
  const rel2 = await financialTransactionService.releaseOrderFunds({
    orderId,
    actor: 'test',
    idempotencyKey: replayKey
  });
  assert.strictEqual(rel2.success, true);

  // Assert zero double-increment on replay
  const clr2 = await postgresStore.getPool().query('SELECT * FROM earnings_clearing WHERE order_id = $1', [orderId]);
  assert.strictEqual(clr2.rows.length, 1, 'Still exactly 1 row in earnings_clearing after replay');

  const user2 = await store.getUser(sellerId);
  assert.strictEqual(user2?.completedJobs, 1, 'Seller completedJobs must NOT double increment');
  assert.strictEqual(user2?.earned, 80, 'Seller earned must NOT double increment');
});

test('Finance Vault Invariant 7: Universal Money Amount Validation', () => {
  // Reject zero unless allowed
  assert.throws(() => assertValidMoneyAmount(0), /greater than zero/i);
  assert.strictEqual(assertValidMoneyAmount(0, 'fee', true), 0);

  // Reject negative
  assert.throws(() => assertValidMoneyAmount(-10), /greater than zero/i);
  assert.throws(() => assertValidMoneyAmount(-0.01, 'amount', true), /cannot be negative/i);

  // Reject non-finite, NaN
  assert.throws(() => assertValidMoneyAmount(NaN), /finite number/i);
  assert.throws(() => assertValidMoneyAmount(Infinity), /finite number/i);
  assert.throws(() => assertValidMoneyAmount(-Infinity), /finite number/i);

  // Reject non-number types
  assert.throws(() => assertValidMoneyAmount('100' as any), /finite number/i);
  assert.throws(() => assertValidMoneyAmount(null as any), /finite number/i);
  assert.throws(() => assertValidMoneyAmount(undefined as any), /finite number/i);

  // Reject excess decimal precision (sub-cent attacks)
  assert.throws(() => assertValidMoneyAmount(10.999), /excess decimal precision/i);
  assert.throws(() => assertValidMoneyAmount(0.004), /excess decimal precision/i);
  assert.throws(() => assertValidMoneyAmount(1.23456), /excess decimal precision/i);

  // Valid amounts
  assert.strictEqual(assertValidMoneyAmount(10.99), 10.99);
  assert.strictEqual(assertValidMoneyAmount(0.01), 0.01);
  assert.strictEqual(assertValidMoneyAmount(100), 100);
  assert.strictEqual(assertValidMoneyAmount(250.5), 250.5);
});

test('Finance Vault Invariant 8: Gateway Secret Encryption & Hydration Decryption', () => {
  const secret = 'sk_live_very_secret_test_key_xyz123';

  // 1. Encrypt and decrypt round trip
  const encrypted = encryptSecret(secret);
  assert.ok(encrypted.startsWith('enc:'), 'Encrypted secret must start with "enc:" prefix');
  assert.notStrictEqual(encrypted, secret, 'Encrypted secret must differ from plaintext');

  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, secret, 'decryptSecret must recover original plaintext');

  // 2. Hydration in PaymentGatewayManager
  paymentGatewayManager.loadFromState({
    sandbox: {
      stripe: {
        enabled: true,
        clientId: 'pk_test_sample',
        clientSecret: encrypted,
        webhookId: 'whsec_sample',
        primary: true
      },
      paypal: { enabled: false, clientId: '', clientSecret: '', webhookId: '', primary: false },
      razorpay: { enabled: false, clientId: '', clientSecret: '', webhookId: '', primary: false }
    }
  });

  // In-memory runtime gateway config has decrypted secret
  const gw = paymentGatewayManager.getGateway('stripe', 'sandbox');
  assert.strictEqual(
    gw.clientSecret,
    secret,
    'paymentGatewayManager must hydrate decrypted clientSecret into runtime config'
  );

  // Exported state for storage must NEVER contain raw secret
  const exported = paymentGatewayManager.getEncryptedState();
  const exportedKey = exported.sandbox.stripe.clientSecret;
  assert.ok(
    exportedKey.startsWith('enc:') || exportedKey.includes('••••'),
    `Exported state must be encrypted or masked, got "${exportedKey}"`
  );
  assert.notStrictEqual(
    exportedKey,
    secret,
    'Exported state must not expose plaintext secret'
  );
});
