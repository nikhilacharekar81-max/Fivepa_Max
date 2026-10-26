process.env.PORT = '3011';
(process.env as any).NODE_ENV = 'test';

import assert from 'node:assert';
import { postgresStore } from '../server/db/postgresStore.js';
import { store } from '../server/store.js';
import { signToken } from '../server/middleware/auth.js';
import { financialTransactionService } from '../server/domains/finance/index.js';
import type { Order, UserAccount } from '../src/types.js';

const PORT = 3011;

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

async function runTests() {
  console.log('\n--- STARTING PHASE 9 PRODUCTION HARDENING REGRESSION SUITE ---');

  await postgresStore.runMigrations();
  const serverMod = await import('../server.js');
  if (!serverMod.server.listening) {
    await new Promise((resolve) => serverMod.server.once('listening', resolve));
  }
  const addr = serverMod.server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
  const BASE = `http://127.0.0.1:${actualPort}`;

  async function api(endpoint: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    const url = `${BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json, ok: res.ok };
  }

  const pool = postgresStore.getPool();
  const T0 = Date.now();

  const buyerId = `usr_p9_buyer_${T0}`;
  const sellerId = `usr_p9_seller_${T0}`;
  const otherId = `usr_p9_other_${T0}`;

  const buyer: UserAccount = {
    id: buyerId,
    name: 'Phase9 Buyer',
    email: `p9_buyer_${T0}@example.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 0,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 0,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  };

  const seller: UserAccount = {
    id: sellerId,
    name: 'Phase9 Seller',
    email: `p9_seller_${T0}@example.com`,
    role: 'freelancer',
    status: 'active',
    verified: true,
    walletBalance: 0,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 50,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  };

  const otherUser: UserAccount = {
    id: otherId,
    name: 'Phase9 Other',
    email: `p9_other_${T0}@example.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 250,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 0,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  };

  await store.saveUser(buyer);
  await store.saveUser(seller);
  await store.saveUser(otherUser);

  await financialTransactionService.ensureWallet({ userId: buyerId, name: buyer.name, email: buyer.email, role: 'buyer' });
  await financialTransactionService.ensureWallet({ userId: sellerId, name: seller.name, email: seller.email, role: 'freelancer' });

  await financialTransactionService.creditDeposit({
    userId: buyerId,
    amount: 1000,
    reference: `DEP-P9-${T0}`,
    idempotencyKey: `dep_p9_${T0}`,
    actor: 'test'
  });

  const buyerToken = signToken({ id: buyerId, role: 'buyer', email: buyer.email, sessionVersion: 1 });
  const sellerToken = signToken({ id: sellerId, role: 'freelancer', email: seller.email, sessionVersion: 1 });
  const otherToken = signToken({ id: otherId, role: 'buyer', email: otherUser.email, sessionVersion: 1 });

  // =========================================================================
  // 1. Chart of Accounts Liability Entries (2010, 2050, 2020, 2040)
  // =========================================================================
  console.log('\n>>> 1. Chart of Accounts Liability Entries (2010 -> 2050 -> 2020 -> 2040)');
  const coaOrderId = `ord_p9_coa_${T0}`;
  const coaOrder: Order = {
    id: coaOrderId,
    title: 'Phase 9 CoA Order',
    buyerId,
    sellerId,
    amount: 200,
    status: 'payment_pending',
    createdAt: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  };
  await store.saveOrder(coaOrder);

  // Fund escrow ($200 + $2 buyer fee = $202 debited from 2010)
  await financialTransactionService.fundEscrow({
    orderId: coaOrderId,
    orderTitle: coaOrder.title,
    amount: 200,
    buyerId,
    sellerId,
    actor: `user:${buyerId}`,
    idempotencyKey: `fund_p9_${T0}`
  });

  const fundEntriesRes = await pool.query(
    `SELECT e.account_code, e.debit, e.credit, j.event_type
     FROM ledger_entries e
     JOIN ledger_journals j ON j.id = e.journal_id
     WHERE e.order_id = $1 AND j.event_type = 'ORDER_ESCROW_FUNDED'`,
    [coaOrderId]
  );
  const acc2010Debit = fundEntriesRes.rows.find((r: any) => r.account_code === '2010');
  assert.ok(acc2010Debit && Number(acc2010Debit.debit) === 202, '2010 must be debited $202 on escrow fund');
  ok('Account 2010 debited on ORDER_ESCROW_FUNDED');

  // Release escrow ($200 gross -> $160 net credited to 2050 Pending Clearance, $40 credited to 4010)
  await financialTransactionService.releaseOrderFunds({
    orderId: coaOrderId,
    actor: `user:${buyerId}`,
    idempotencyKey: `rel_p9_${T0}`
  });

  const relEntriesRes = await pool.query(
    `SELECT e.account_code, e.debit, e.credit, j.event_type
     FROM ledger_entries e
     JOIN ledger_journals j ON j.id = e.journal_id
     WHERE e.order_id = $1 AND j.event_type = 'ESCROW_RELEASED_TO_FREELANCER'`,
    [coaOrderId]
  );
  const acc2050Credit = relEntriesRes.rows.find((r: any) => r.account_code === '2050');
  assert.ok(acc2050Credit && Number(acc2050Credit.credit) === 160, '2050 must be credited $160 on escrow release');
  ok('Account 2050 credited on ESCROW_RELEASED_TO_FREELANCER');

  // Fast-forward clearance_end in earnings_clearing and run processEarningsClearing (2050 debited, 2020 credited)
  await pool.query(
    `UPDATE earnings_clearing SET clearance_end = NOW() - INTERVAL '1 hour' WHERE order_id = $1`,
    [coaOrderId]
  );
  const clearResult = await financialTransactionService.processEarningsClearing();
  assert.ok(clearResult.clearedCount >= 1, 'processEarningsClearing must clear matured earnings');

  const clearEntriesRes = await pool.query(
    `SELECT e.account_code, e.debit, e.credit, j.event_type
     FROM ledger_entries e
     JOIN ledger_journals j ON j.id = e.journal_id
     WHERE e.order_id = $1 AND j.event_type = 'EARNINGS_CLEARED'`,
    [coaOrderId]
  );
  const acc2050ClearDebit = clearEntriesRes.rows.find((r: any) => r.account_code === '2050');
  const acc2020ClearCredit = clearEntriesRes.rows.find((r: any) => r.account_code === '2020');
  assert.ok(acc2050ClearDebit && Number(acc2050ClearDebit.debit) === 160, '2050 must be debited $160 on clearing');
  assert.ok(acc2020ClearCredit && Number(acc2020ClearCredit.credit) === 160, '2020 must be credited $160 on clearing');
  ok('Account 2050 debited and 2020 credited on EARNINGS_CLEARED');

  // Request payout ($50 -> 2020 debited, 2040 credited)
  const payoutId = `pay_p9_${T0}`;
  await financialTransactionService.requestPayout({
    payoutId,
    freelancerId: sellerId,
    amount: 50,
    method: 'Bank Transfer',
    accountDetails: 'Checking 1234',
    actor: `user:${sellerId}`,
    idempotencyKey: `payout_p9_${T0}`
  });

  const payoutEntriesRes = await pool.query(
    `SELECT e.account_code, e.debit, e.credit, j.event_type
     FROM ledger_entries e
     JOIN ledger_journals j ON j.id = e.journal_id
     WHERE e.payout_id = $1 AND j.event_type IN ('PAYOUT_REQUESTED', 'PAYOUT_REQUESTED_HOLD')`,
    [payoutId]
  );
  const acc2020PayoutDebit = payoutEntriesRes.rows.find((r: any) => r.account_code === '2020');
  const acc2040PayoutCredit = payoutEntriesRes.rows.find((r: any) => r.account_code === '2040');
  assert.ok(acc2020PayoutDebit && Number(acc2020PayoutDebit.debit) === 50, '2020 must be debited $50 on payout request');
  assert.ok(acc2040PayoutCredit && Number(acc2040PayoutCredit.credit) === 50, '2040 must be credited $50 on payout request');
  ok('Account 2020 debited and 2040 credited on PAYOUT_REQUESTED');

  // =========================================================================
  // 2. topUpEscrow Rejects 'released' Escrows
  // =========================================================================
  console.log('\n>>> 2. topUpEscrow Rejects Released Escrows');
  await assert.rejects(
    async () => {
      await financialTransactionService.topUpEscrow({
        orderId: coaOrderId,
        orderTitle: coaOrder.title,
        amount: 50,
        buyerId,
        sellerId,
        actor: `user:${buyerId}`,
        idempotencyKey: `topup_rel_p9_${T0}`
      });
    },
    /released|held/i,
    'topUpEscrow must reject released escrows'
  );
  ok('topUpEscrow rejected released escrow');

  // =========================================================================
  // 3. reverseJournal Rejects Lifecycle Journals
  // =========================================================================
  console.log('\n>>> 3. reverseJournal Rejects Lifecycle Journals');
  const lifecycleJournalsRes = await pool.query(
    `SELECT DISTINCT j.id, j.event_type
     FROM ledger_journals j
     JOIN ledger_entries e ON e.journal_id = j.id
     WHERE e.order_id = $1 AND j.event_type IN ('ORDER_ESCROW_FUNDED', 'ESCROW_RELEASED_TO_FREELANCER')`,
    [coaOrderId]
  );
  assert.strictEqual(lifecycleJournalsRes.rows.length, 2, 'Both lifecycle journals must exist');

  for (const jRow of lifecycleJournalsRes.rows) {
    await assert.rejects(
      async () => {
        await financialTransactionService.reverseJournal({
          journalId: jRow.id,
          reason: 'Attempted raw reversal of lifecycle journal',
          actor: 'admin',
          idempotencyKey: `rev_block_${jRow.id}_${T0}`
        });
      },
      /Cannot directly reverse lifecycle journal/i,
      `reverseJournal must reject ${jRow.event_type}`
    );
  }
  ok('reverseJournal rejected ORDER_ESCROW_FUNDED and ESCROW_RELEASED_TO_FREELANCER');

  // =========================================================================
  // 4. POST /api/orders/:id/cancel Blocks Buyer from Directly Cancelling in_progress or delivered Order (403)
  // =========================================================================
  console.log('\n>>> 4. POST /api/orders/:id/cancel Blocks Buyer on in_progress / delivered Orders');
  const activeOrderId = `ord_p9_active_${T0}`;
  const activeOrder: Order = {
    id: activeOrderId,
    title: 'Phase 9 Active Order',
    orderType: 'gig',
    gigOrderId: activeOrderId,
    buyerId,
    sellerId,
    amount: 100,
    status: 'in_progress',
    createdAt: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  };
  await store.saveOrder(activeOrder);
  await financialTransactionService.fundEscrow({
    orderId: activeOrderId,
    orderTitle: activeOrder.title,
    amount: 100,
    buyerId,
    sellerId,
    actor: `user:${buyerId}`,
    idempotencyKey: `fund_active_p9_${T0}`
  });

  const cancelInProgressRes = await api(`/api/orders/${activeOrderId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { reason: 'Unilateral buyer cancel attempt on in_progress order' }
  });
  assert.strictEqual(cancelInProgressRes.status, 403, 'Buyer direct cancel on in_progress order must return 403');
  ok('Buyer blocked from directly cancelling in_progress order (403)');

  activeOrder.status = 'delivered';
  await store.saveOrder(activeOrder);

  const cancelDeliveredRes = await api(`/api/orders/${activeOrderId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { reason: 'Unilateral buyer cancel attempt on delivered order' }
  });
  assert.strictEqual(cancelDeliveredRes.status, 403, 'Buyer direct cancel on delivered order must return 403');
  ok('Buyer blocked from directly cancelling delivered order (403)');

  // =========================================================================
  // 5. Unlimited Gigs: Seller Can Create > 5 Active Gigs Without Error
  // =========================================================================
  console.log('\n>>> 5. Unlimited Gigs Per Freelancer (> 5 Active Gigs)');
  for (let i = 1; i <= 7; i++) {
    const gigRes = await api('/api/gigs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: {
        title: `Phase 9 Unlimited Gig #${i} (${T0})`,
        category: 'Technology & Programming',
        subcategory: 'Web Development',
        description: 'High performance web engineering service',
        price: 50 + i * 10,
        deliveryDays: 3,
        status: 'published'
      }
    });
    assert.strictEqual(gigRes.status, 200, `Creating active gig #${i} must succeed with 200`);
  }
  ok('Seller created 7 active published gigs without restriction');

  // =========================================================================
  // 6. Buyer-First Review Rule & Completed-Only Reviews
  // =========================================================================
  console.log('\n>>> 6. Buyer-First Review Rule');
  const revOrderId = `ord_p9_rev_${T0}`;
  const revOrder: Order = {
    id: revOrderId,
    title: 'Phase 9 Review Order',
    buyerId,
    sellerId,
    amount: 100,
    status: 'completed',
    createdAt: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    completedAt: new Date().toISOString()
  };
  await store.saveOrder(revOrder);

  // 6a. Seller tries to review BEFORE buyer -> 403
  const sellerEarlyRev = await api('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: {
      orderId: revOrderId,
      rating: 5,
      comment: 'Seller trying to review before buyer'
    }
  });
  assert.strictEqual(sellerEarlyRev.status, 403, 'Seller review before buyer review must be rejected with 403');
  ok('Seller review before buyer review rejected with 403');

  // 6b. Buyer submits review -> 200/201
  const buyerRev = await api('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: {
      orderId: revOrderId,
      rating: 5,
      comment: 'Excellent work by freelancer!'
    }
  });
  assert.ok(buyerRev.status === 200 || buyerRev.status === 201, 'Buyer review must succeed with 200/201');
  ok('Buyer review succeeded with 200/201');

  // 6c. Seller submits review AFTER buyer -> 200/201
  const sellerAfterRev = await api('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: {
      orderId: revOrderId,
      rating: 5,
      comment: 'Great buyer to work with!'
    }
  });
  assert.ok(sellerAfterRev.status === 200 || sellerAfterRev.status === 201, 'Seller review after buyer review must succeed with 200/201');
  ok('Seller review after buyer review succeeded with 200/201');

  // =========================================================================
  // 7. GET /api/users/:id Public Privacy (sanitizePublicUser)
  // =========================================================================
  console.log('\n>>> 7. GET /api/users/:id Public User Privacy');
  const publicProfileRes = await api(`/api/users/${buyerId}`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  assert.strictEqual(publicProfileRes.status, 200, 'GET /api/users/:id must return 200');
  assert.strictEqual(publicProfileRes.json.email, undefined, 'Public profile must NOT expose email');
  assert.strictEqual(publicProfileRes.json.walletBalance, undefined, 'Public profile must NOT expose walletBalance');
  assert.strictEqual(publicProfileRes.json.mobile, undefined, 'Public profile must NOT expose mobile');
  ok('GET /api/users/:id returned sanitizePublicUser with no email or walletBalance exposed');

  // Self lookup still returns own profile fields
  const selfProfileRes = await api(`/api/users/${buyerId}`, {
    headers: { Authorization: `Bearer ${buyerToken}` }
  });
  assert.strictEqual(selfProfileRes.status, 200);
  assert.strictEqual(selfProfileRes.json.email, buyer.email, 'User viewing own profile receives email');
  ok('Authenticated user viewing own profile still receives safeUser');

  // =========================================================================
  // 8. Non-Deletable Workstream Messages & Uploads + 6-Char Unrestricted Passwords
  // =========================================================================
  console.log('\n>>> 8. Non-Deletable Workstream Messages & Uploads + 6-Char Unrestricted Passwords');
  const delMsgRes = await api(`/api/messages/msg_test_${T0}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${buyerToken}` }
  });
  assert.strictEqual(delMsgRes.status, 403, 'DELETE /api/messages/:id must be rejected with 403');
  ok('Workstream messages cannot be deleted (403)');

  const delUploadRes = await api(`/api/workstream/files/test_file_${T0}.pdf`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${buyerToken}` }
  });
  assert.strictEqual(delUploadRes.status, 403, 'DELETE /api/workstream/files/:filename must be rejected with 403');
  ok('Workstream uploads cannot be deleted (403)');

  // 6-character unrestricted password check
  const shortSignupRes = await api('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Short Pw User',
      email: `shortpw_${T0}@test.com`,
      password: '12345',
      confirmPassword: '12345'
    }
  });
  assert.strictEqual(shortSignupRes.status, 400, 'Password under 6 characters must be rejected with 400');

  const sixCharSignupRes = await api('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Six Char Pw User',
      email: `sixchar_${T0}@test.com`,
      password: '123456',
      confirmPassword: '123456'
    }
  });
  assert.strictEqual(sixCharSignupRes.status, 201, '6-character unrestricted password must succeed with 201');
  ok('6-character password with no restrictions accepted on signup; <6 rejected');

  console.log('\n🎉 ALL PHASE 9 PRODUCTION HARDENING TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Phase 9 Test Failure:', err);
  process.exit(1);
});
