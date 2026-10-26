import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  store,
  postgresStore,
  orders,
  gigs,
  projects,
  proposals,
  reviews,
  messages,
  disputes,
  refunds,
  payouts,
  customInvoices,
  workstreamOffers,
  auditLogs
} from '../server/store.js';
import { workspaceService } from '../src/server/workspaceService.js';
import { DEFAULT_FEE_CONFIG, calculateOrderFees } from '../src/shared/fees.js';
import { siteSettings } from '../server/domains/admin/siteSettings.js';

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

test('Architecture Invariant 1: Direct-SQL Deletion, Anti-Resurrection & Frozen Array Traps', async (t) => {
  await postgresStore.runMigrations();

  // 1. Verify all legacy exported arrays are frozen traps
  const legacyArrays = [
    { name: 'orders', arr: orders },
    { name: 'gigs', arr: gigs },
    { name: 'projects', arr: projects },
    { name: 'proposals', arr: proposals },
    { name: 'reviews', arr: reviews },
    { name: 'messages', arr: messages },
    { name: 'disputes', arr: disputes },
    { name: 'refunds', arr: refunds },
    { name: 'payouts', arr: payouts },
    { name: 'customInvoices', arr: customInvoices },
    { name: 'workstreamOffers', arr: workstreamOffers },
    { name: 'auditLogs', arr: auditLogs }
  ];

  for (const { name, arr } of legacyArrays) {
    assert.strictEqual(Object.isFrozen(arr), true, `Legacy exported array '${name}' must be Object.freeze([])`);
    assert.throws(() => {
      (arr as any).push({ id: 'illegal_push' });
    }, /Cannot add property|object is not extensible|frozen/i, `Mutating frozen array '${name}' must throw immediately`);
  }

  // 2. Direct-SQL Deletion Anti-Resurrection (Order)
  const testOrderId = `inv_order_${Date.now()}`;
  await store.saveUser({
    id: 'user_buyer_1',
    name: 'Test Buyer',
    email: 'buyer1@test.com',
    role: 'buyer',
    status: 'active',
    verified: true,
    emailVerified: true,
    walletBalance: 1000,
    avatar: '',
    title: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 0,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  });
  await store.saveUser({
    id: 'user_seller_1',
    name: 'Test Seller',
    email: 'seller1@test.com',
    role: 'freelancer',
    status: 'active',
    verified: true,
    emailVerified: true,
    walletBalance: 1000,
    avatar: '',
    title: 'Developer',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 50,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  });
  await store.saveOrder({
    id: testOrderId,
    title: 'Invariant Direct SQL Test Order',
    buyerId: 'user_buyer_1',
    sellerId: 'user_seller_1',
    amount: 150,
    status: 'funded_in_escrow',
    createdAt: new Date().toISOString(),
    dueDate: new Date().toISOString()
  });

  const fetchedOrder = await store.getOrder(testOrderId);
  assert.ok(fetchedOrder, 'Order must be saved and queryable via store facade');
  assert.strictEqual(fetchedOrder?.id, testOrderId);

  // Directly delete from PostgreSQL without calling store.save*
  await postgresStore.getPool().query('DELETE FROM orders WHERE id = $1', [testOrderId]);

  // Query store again: MUST return undefined, NOT resurrect from in-memory ghost cache
  const reloadedOrder = await store.getOrder(testOrderId);
  assert.strictEqual(reloadedOrder, undefined, 'Order deleted via direct SQL must return undefined from store.getOrder');

  // 3. Direct-SQL Deletion Anti-Resurrection (Workspace)
  const testWs = workspaceService.createWorkspace({
    buyerId: 'user_buyer_1',
    sellerId: 'user_seller_1',
    originType: 'gig',
    originId: 'gig_inv_1'
  });

  const wsId = testWs.workspaceId;
  const fetchedWs = await workspaceService.getWorkspaceAsync(wsId);
  assert.ok(fetchedWs, 'Workspace must be accessible via getWorkspaceAsync');
  assert.strictEqual(fetchedWs?.workspaceId, wsId);

  // Directly delete from PostgreSQL
  await postgresStore.deleteWorkspace(wsId);

  // Query workspace again: MUST return undefined
  const reloadedWs = await workspaceService.getWorkspaceAsync(wsId);
  assert.strictEqual(reloadedWs, undefined, 'Workspace deleted via PostgreSQL must return undefined (no cache ghost)');
});

test('Architecture Invariant 2: FivePA Fee Policy & Exact Calculation Snapshots', async (t) => {
  // 1. FivePA Fee Default Policy
  assert.strictEqual(DEFAULT_FEE_CONFIG.commissionPercent, 20, 'FivePA default platform commission must be 20%');
  assert.strictEqual(DEFAULT_FEE_CONFIG.buyerFeePercent, 1, 'FivePA default buyer fee must be 1%');
  assert.strictEqual(DEFAULT_FEE_CONFIG.smallOrderFee, 1, 'FivePA default small order fee must be $1.00');
  assert.strictEqual(DEFAULT_FEE_CONFIG.smallOrderThreshold, 200, 'FivePA small order threshold must be strictly $200');

  // 2. Minimum marketplace price must be <= $1.00
  const settings = siteSettings.getSettings();
  assert.ok(settings.commission.minimumOrderAmount <= 1, 'Minimum order amount must be <= $1.00');

  // 3. Exact FivePA Calculation for $50 order (< $200 threshold)
  const feesSmall = calculateOrderFees(50);
  assert.strictEqual(feesSmall.gigPrice, 50, 'Gig price must be $50.00');
  assert.strictEqual(feesSmall.platformCommission, 10, 'Platform commission must be 20% ($10.00)');
  assert.strictEqual(feesSmall.freelancerNet, 40, 'Freelancer net must be $40.00');
  assert.strictEqual(feesSmall.serviceFee, 0.5, 'Buyer service fee must be 1% ($0.50)');
  assert.strictEqual(feesSmall.smallOrderFee, 1.0, 'Small order fee must be $1.00 under $200');
  assert.strictEqual(feesSmall.clientTotal, 51.5, 'Buyer total checkout must be $51.50');

  // 4. Exact FivePA Calculation for $250 order (>= $200 threshold)
  const feesLarge = calculateOrderFees(250);
  assert.strictEqual(feesLarge.gigPrice, 250, 'Gig price must be $250.00');
  assert.strictEqual(feesLarge.platformCommission, 50, 'Platform commission must be 20% ($50.00)');
  assert.strictEqual(feesLarge.freelancerNet, 200, 'Freelancer net must be $200.00');
  assert.strictEqual(feesLarge.serviceFee, 2.5, 'Buyer service fee must be 1% ($2.50)');
  assert.strictEqual(feesLarge.smallOrderFee, 0, 'Small order fee must be $0.00 at or above $200');
  assert.strictEqual(feesLarge.clientTotal, 252.5, 'Buyer total checkout must be $252.50');
});

test('Architecture Invariant 3: Static Source Code Scanner (Zero Split-Brain Mutators & Zero Currency Drift)', async (t) => {
  // 1. Scan server/**/*.ts for banned in-memory mutators
  const serverFiles = getFiles(path.join(ROOT, 'server'), ['.ts']);
  const violations: string[] = [];

  for (const file of serverFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    if (content.includes('orderIndex.set(') || content.includes('orderIndex.delete(')) {
      violations.push(`${rel}: contains legacy orderIndex runtime mutation`);
    }
    if (content.includes('messageIndex.set(') || content.includes('messageIndex.get(')) {
      violations.push(`${rel}: contains legacy messageIndex runtime read/write`);
    }
  }

  assert.strictEqual(violations.length, 0, `Forbidden runtime cache mutations detected:\n${violations.join('\n')}`);

  // 2. Scan src/ for rogue non-dollar currency symbols (e.g. ₹)
  const clientFiles = getFiles(path.join(ROOT, 'src'), ['.ts', '.tsx']);
  const currencyViolations: string[] = [];

  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    if (content.includes('₹')) {
      currencyViolations.push(`${rel}: contains non-standard currency symbol '₹'`);
    }
  }

  assert.strictEqual(currencyViolations.length, 0, `Rogue currency symbols found in client:\n${currencyViolations.join('\n')}`);
});
