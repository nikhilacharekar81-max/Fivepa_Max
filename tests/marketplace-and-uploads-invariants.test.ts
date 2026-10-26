process.env.PORT = '3008';
(process.env as any).NODE_ENV = 'test';

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { postgresStore } from '../server/db/postgresStore.js';
import { store } from '../server/store.js';
import { signToken } from '../server/middleware/auth.js';
import { cleanupAbandonedWorkstreamUploads, WORKSTREAM_UPLOADS_DIR } from '../server/services/workstreamService.js';
import { financeLedger } from '../server/domains/finance/financeLedger.js';
import type { Order, Project, Proposal, UserAccount } from '../src/types.js';

const PORT = 3008;

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

async function runTests() {
  console.log('\n--- STARTING MARKETPLACE, UPLOADS & DATABASE HARDENING INVARIANTS ---');

  // Import server module to start it
  const serverMod = await import('../server.js');
  if (!serverMod.server.listening) {
    await new Promise((resolve) => serverMod.server.once('listening', resolve));
  }
  const addr = serverMod.server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
  const BASE = `http://127.0.0.1:${actualPort}`;

  async function api(endpoint: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    const url = `${BASE}${endpoint}`;
    const isRaw = Buffer.isBuffer(options.body) || (typeof options.body === 'string' && !options.headers?.['Content-Type']?.includes('json'));
    const headers: Record<string, string> = {
      ...(isRaw ? { 'Content-Type': 'application/octet-stream' } : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? (isRaw ? options.body : JSON.stringify(options.body)) : undefined
    });

    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json, ok: res.ok };
  }

  const pool = postgresStore.getPool();
  const T0 = Date.now();

  // =========================================================================
  // Test 1: Workstream Upload Context & 7-Day Cleanup Protection
  // =========================================================================
  console.log('\n>>> Test 1: Workstream Upload Context & 7-Day Cleanup Protection');
  const buyer1Id = `usr_up_b_${T0}`;
  const seller1Id = `usr_up_s_${T0}`;
  const stranger1Id = `usr_up_x_${T0}`;

  const buyer1: UserAccount = {
    id: buyer1Id,
    name: 'Upload Buyer',
    email: `buyer_${T0}@up.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 1000,
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

  const seller1: UserAccount = {
    id: seller1Id,
    name: 'Upload Seller',
    email: `seller_${T0}@up.com`,
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

  const stranger1: UserAccount = {
    id: stranger1Id,
    name: 'Upload Stranger',
    email: `stranger_${T0}@up.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 500,
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

  await store.saveUser(buyer1);
  await store.saveUser(seller1);
  await store.saveUser(stranger1);

  const testOrder1: Order = {
    id: `ord_upload_${T0}`,
    title: 'Upload Test Order',
    buyerId: buyer1Id,
    sellerId: seller1Id,
    amount: 100,
    status: 'in_progress',
    createdAt: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  };
  await store.saveOrder(testOrder1);

  const buyerToken = signToken({ id: buyer1Id, role: 'buyer', email: buyer1.email, sessionVersion: 1 });
  const strangerToken = signToken({ id: stranger1Id, role: 'buyer', email: stranger1.email, sessionVersion: 1 });

  // 1a. Upload without orderId/workspaceId -> 400
  const noContextRes = await api('/api/workstream/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: 'Sample File Content 1'
  });
  assert.strictEqual(noContextRes.status, 400, 'POST /workstream/uploads without context must reject with 400');
  ok('Upload without context rejected with 400');

  // 1b. Upload with orderId by non-participant stranger -> 403
  const forbiddenRes = await api(`/api/workstream/uploads?orderId=${testOrder1.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${strangerToken}` },
    body: 'Sample File Content 2'
  });
  assert.strictEqual(forbiddenRes.status, 403, 'POST /workstream/uploads by non-participant must reject with 403');
  ok('Upload by non-participant rejected with 403');

  // 1c. Upload with orderId by participant buyer -> 200
  const validRes = await api(`/api/workstream/uploads?orderId=${testOrder1.id}&name=test_document.pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: 'Sample File Content 3'
  });
  assert.strictEqual(validRes.status, 200, 'POST /workstream/uploads by participant must succeed with 200');
  assert.ok(validRes.json.url, 'Upload response must include file URL');
  ok('Upload by participant succeeded with valid URL');

  // 1d. Workstream Uploads Are Permanently Retained (Never Deleted)
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const fileA = `abandoned_${T0}_fileA.txt`;
  const fileB = `attached_${T0}_fileB.txt`;

  if (!fs.existsSync(WORKSTREAM_UPLOADS_DIR)) {
    fs.mkdirSync(WORKSTREAM_UPLOADS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(WORKSTREAM_UPLOADS_DIR, fileA), 'abandoned data');
  fs.writeFileSync(path.join(WORKSTREAM_UPLOADS_DIR, fileB), 'attached data');

  await store.saveUploadRecord(fileA, {
    ownerId: buyer1Id,
    originalName: 'fileA.txt',
    mime: 'text/plain',
    size: 14,
    createdAt: eightDaysAgo
  });

  await store.saveUploadRecord(fileB, {
    ownerId: buyer1Id,
    originalName: 'fileB.txt',
    mime: 'text/plain',
    size: 13,
    createdAt: eightDaysAgo,
    orderId: testOrder1.id
  });

  await cleanupAbandonedWorkstreamUploads();

  const recA = await store.getUploadRecord(fileA);
  assert.ok(!!recA, 'Workstream upload record A must NOT be deleted');
  assert.strictEqual(fs.existsSync(path.join(WORKSTREAM_UPLOADS_DIR, fileA)), true, 'Workstream file A on disk must be preserved');

  const recB = await store.getUploadRecord(fileB);
  assert.ok(!!recB, 'Workstream upload record B must NOT be deleted');
  assert.strictEqual(fs.existsSync(path.join(WORKSTREAM_UPLOADS_DIR, fileB)), true, 'Workstream file B on disk must be preserved');
  ok('Workstream uploads are permanently retained and never deleted');

  try { fs.unlinkSync(path.join(WORKSTREAM_UPLOADS_DIR, fileA)); } catch {}
  try { fs.unlinkSync(path.join(WORKSTREAM_UPLOADS_DIR, fileB)); } catch {}

  // =========================================================================
  // Test 2: Atomic Proposal Acceptance & Multi-Hire Project Capacity
  // =========================================================================
  console.log('\n>>> Test 2: Atomic Proposal Acceptance & Multi-Hire Project Capacity');
  const buyer2Id = `usr_prop_b_${T0}`;
  const seller2AId = `usr_prop_sA_${T0}`;
  const seller2BId = `usr_prop_sB_${T0}`;

  const buyer2: UserAccount = {
    id: buyer2Id,
    name: 'MultiHire Buyer',
    email: `mhire_${T0}@test.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 10000,
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

  const seller2A: UserAccount = {
    id: seller2AId,
    name: 'MultiHire Seller A',
    email: `selA_${T0}@test.com`,
    role: 'freelancer',
    status: 'active',
    verified: true,
    walletBalance: 0,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 40,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  };

  const seller2B: UserAccount = {
    id: seller2BId,
    name: 'MultiHire Seller B',
    email: `selB_${T0}@test.com`,
    role: 'freelancer',
    status: 'active',
    verified: true,
    walletBalance: 0,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 40,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  };

  await store.saveUser(buyer2);
  await store.saveUser(seller2A);
  await store.saveUser(seller2B);

  financeLedger.ensureWallet({ userId: buyer2Id, name: buyer2.name, email: buyer2.email, role: 'buyer' });
  financeLedger.ensureWallet({ userId: seller2AId, name: seller2A.name, email: seller2A.email, role: 'freelancer' });
  financeLedger.ensureWallet({ userId: seller2BId, name: seller2B.name, email: seller2B.email, role: 'freelancer' });
  financeLedger.creditDeposit({
    userId: buyer2Id,
    amount: 10000,
    description: 'Test seed deposit'
  });
  await pool.query(
    `INSERT INTO wallets (user_id, user_name, user_email, user_role, available_balance)
     VALUES ($1, $2, $3, $4, 10000)
     ON CONFLICT (user_id) DO UPDATE SET available_balance = 10000`,
    [buyer2Id, buyer2.name, buyer2.email, buyer2.role]
  );

  const projectId = `proj_mh_${T0}`;
  const project: Project = {
    id: projectId,
    title: 'Multi-Hire Platform Project',
    buyerId: buyer2Id,
    buyerName: buyer2.name,
    buyerAvatar: '',
    category: 'Development & IT',
    description: 'Project seeking 2 specialists',
    budgetMin: 100,
    budgetMax: 500,
    deadlineDays: 14,
    proposalsCount: 2,
    status: 'open',
    createdAt: new Date().toISOString().split('T')[0],
    maxHires: 2
  };
  await store.saveProject(project);

  const prop1Id = `prop_mh1_${T0}`;
  const prop2Id = `prop_mh2_${T0}`;

  const proposal1: Proposal = {
    id: prop1Id,
    projectId,
    freelancerId: seller2AId,
    freelancerName: seller2A.name,
    bidAmount: 150,
    deliveryDays: 7,
    coverLetter: 'Specialist A proposal',
    status: 'pending',
    createdAt: new Date().toISOString().split('T')[0]
  };

  const proposal2: Proposal = {
    id: prop2Id,
    projectId,
    freelancerId: seller2BId,
    freelancerName: seller2B.name,
    bidAmount: 200,
    deliveryDays: 10,
    coverLetter: 'Specialist B proposal',
    status: 'pending',
    createdAt: new Date().toISOString().split('T')[0]
  };

  await store.saveProposal(proposal1);
  await store.saveProposal(proposal2);

  const buyer2Token = signToken({ id: buyer2Id, role: 'buyer', email: buyer2.email, sessionVersion: 1 });

  // 2a. Concurrent accept on prop1 -> Exactly one 200, one 409
  const [resA, resB] = await Promise.all([
    api(`/api/proposals/${prop1Id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2Token}` }
    }),
    api(`/api/proposals/${prop1Id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2Token}` }
    })
  ]);

  const statuses = [resA.status, resB.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Concurrent accept on proposal must yield exactly one 200 and one 409');
  ok('Atomic proposal accept prevented double-accept race condition (200 / 409)');

  // 2b. Project with maxHires=2 remains 'open' after 1st accepted proposal
  const projAfterHire1 = await store.getProject(projectId);
  assert.strictEqual(projAfterHire1?.status, 'open', 'Project with maxHires=2 must stay open after 1st accepted proposal');
  ok('Project remains open while hiresCount < maxHires');

  // 2c. Accept proposal 2 -> hiresCount reaches maxHires (2/2) -> project transitions to 'in-progress'
  const res2 = await api(`/api/proposals/${prop2Id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer2Token}` }
  });
  assert.strictEqual(res2.status, 200, 'Accepting 2nd proposal must succeed');

  const projAfterHire2 = await store.getProject(projectId);
  assert.ok(
    projAfterHire2?.status === 'in-progress' || projAfterHire2?.status === 'in_progress',
    'Project must transition to in-progress when hiresCount reaches maxHires'
  );
  ok('Project transitioned to in-progress when maxHires capacity was reached');

  // =========================================================================
  // Test 3: Order Cancellation Whitelist & Review Verification Guards
  // =========================================================================
  console.log('\n>>> Test 3: Order Cancellation Whitelist & Review Verification Guards');
  const buyer3Id = `usr_grd_b_${T0}`;
  const seller3Id = `usr_grd_s_${T0}`;
  const stranger3Id = `usr_grd_x_${T0}`;

  const buyer3: UserAccount = {
    id: buyer3Id,
    name: 'Guard Buyer',
    email: `gbuyer_${T0}@test.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 2000,
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

  const seller3: UserAccount = {
    id: seller3Id,
    name: 'Guard Seller',
    email: `gseller_${T0}@test.com`,
    role: 'freelancer',
    status: 'active',
    verified: true,
    walletBalance: 100,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 50,
    earned: 100,
    completedJobs: 1,
    bio: '',
    skills: [],
    createdAt: new Date().toISOString()
  };

  const stranger3: UserAccount = {
    id: stranger3Id,
    name: 'Stranger Buyer',
    email: `gstranger_${T0}@test.com`,
    role: 'buyer',
    status: 'active',
    verified: true,
    walletBalance: 500,
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

  await store.saveUser(buyer3);
  await store.saveUser(seller3);
  await store.saveUser(stranger3);

  const completedOrderId = `ord_completed_${T0}`;
  const completedOrder: Order = {
    id: completedOrderId,
    title: 'Completed Guard Order',
    buyerId: buyer3Id,
    sellerId: seller3Id,
    amount: 150,
    status: 'completed',
    createdAt: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    completedAt: new Date().toISOString()
  };
  await store.saveOrder(completedOrder);

  const buyer3Token = signToken({ id: buyer3Id, role: 'buyer', email: buyer3.email, sessionVersion: 1 });
  const stranger3Token = signToken({ id: stranger3Id, role: 'buyer', email: stranger3.email, sessionVersion: 1 });

  // 3a. Cancel completed order -> 400
  const cancelRes = await api(`/api/orders/${completedOrderId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer3Token}` },
    body: { reason: 'Cancellation after delivery' }
  });
  assert.strictEqual(cancelRes.status, 400, 'POST /orders/:id/cancel on completed order must reject with 400');
  ok('Order cancellation on completed order rejected with 400');

  // 3b. Review without a completed order between users -> 403
  const unverifiedReviewRes = await api('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stranger3Token}` },
    body: {
      freelancerId: seller3Id,
      rating: 5,
      comment: 'Review without an order'
    }
  });
  assert.strictEqual(unverifiedReviewRes.status, 403, 'POST /reviews without completed order between users must reject with 403');
  ok('Unverified review without completed order rejected with 403');

  // 3c. Review with verified completed order -> 200
  const verifiedReviewRes = await api('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer3Token}` },
    body: {
      orderId: completedOrderId,
      rating: 5,
      comment: 'Verified deliverable accepted and reviewed'
    }
  });
  assert.ok(
    verifiedReviewRes.status === 200 || verifiedReviewRes.status === 201,
    'POST /reviews on verified order must succeed with 200 or 201'
  );
  ok('Verified review on completed order succeeded with 200/201');

  // =========================================================================
  // Test 4: Auth Verification Code DB Persistence & Password Change Security
  // =========================================================================
  console.log('\n>>> Test 4: Auth Verification Code DB Persistence & Password Change Security');
  const userEmail = `auth_test_${T0}@example.com`;
  const initialPlainPassword = 'originalPassword123';
  const initialHashedPassword = await bcrypt.hash(initialPlainPassword, 10);

  const testUser: UserAccount = {
    id: `usr_auth_${T0}`,
    name: 'Auth Security User',
    email: userEmail,
    role: 'buyer',
    status: 'active',
    verified: false,
    emailVerified: false,
    walletBalance: 0,
    avatar: '',
    rating: 5,
    reviewsCount: 0,
    hourlyRate: 0,
    earned: 0,
    completedJobs: 0,
    bio: '',
    skills: [],
    password: initialHashedPassword,
    createdAt: new Date().toISOString()
  };

  await store.saveUser(testUser);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [initialHashedPassword, testUser.id]);

  // 4a. Persist verification code in PostgreSQL table: auth_verification_codes
  const testCode = '619283';
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_verification_codes (email, code, type, expires_at, created_at)
     VALUES ($1, $2, 'verify', $3, NOW())
     ON CONFLICT (email, type) DO UPDATE SET code = $2, type = 'verify', expires_at = $3, created_at = NOW()`,
    [userEmail, testCode, expiresAt]
  );

  const dbRow = await pool.query("SELECT * FROM auth_verification_codes WHERE email = $1", [userEmail]);
  assert.strictEqual(dbRow.rows.length, 1, 'Verification code must be present in auth_verification_codes table');
  assert.strictEqual(dbRow.rows[0].code, testCode, 'Verification code in DB must match');
  ok('Verification code successfully persisted in PostgreSQL auth_verification_codes table');

  // Verify email using that code
  const verifyRes = await api('/api/auth/verify-email', {
    method: 'POST',
    body: { email: userEmail, code: testCode }
  });
  assert.strictEqual(verifyRes.status, 200, 'POST /api/auth/verify-email must succeed with 200');

  const afterVerify = await pool.query("SELECT * FROM auth_verification_codes WHERE email = $1", [userEmail]);
  assert.strictEqual(afterVerify.rows.length, 0, 'Used verification code must be deleted from DB');
  ok('Email verified and code deleted from database');

  // 4b. Password Change Security on PUT /api/users/:id
  const testUserToken = signToken({ id: testUser.id, role: 'buyer', email: testUser.email, sessionVersion: 1 });

  // Missing currentPassword -> 400
  const noCurrentPwRes = await api(`/api/users/${testUser.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${testUserToken}` },
    body: { password: 'newSuperSecretPassword123' }
  });
  assert.strictEqual(noCurrentPwRes.status, 400, 'Password change without currentPassword must reject with 400');
  ok('Password change without currentPassword rejected with 400');

  // Wrong currentPassword -> 400
  const wrongCurrentPwRes = await api(`/api/users/${testUser.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${testUserToken}` },
    body: { currentPassword: 'incorrectPasswordAttempt', password: 'newSuperSecretPassword123' }
  });
  assert.strictEqual(wrongCurrentPwRes.status, 400, 'Password change with wrong currentPassword must reject with 400');
  ok('Password change with wrong currentPassword rejected with 400');

  // Correct currentPassword -> 200
  const correctPwRes = await api(`/api/users/${testUser.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${testUserToken}` },
    body: { currentPassword: initialPlainPassword, password: 'newSuperSecretPassword123' }
  });
  assert.strictEqual(correctPwRes.status, 200, 'Password change with correct currentPassword must succeed with 200');

  const updatedUserRes = await pool.query("SELECT password_hash FROM users WHERE id = $1", [testUser.id]);
  const newHash = updatedUserRes.rows[0]?.password_hash;
  assert.ok(await bcrypt.compare('newSuperSecretPassword123', newHash), 'Password hash in DB must match new password');
  ok('Password successfully updated and verified in database with currentPassword check');

  console.log('\n🎉 ALL Phase 8B Marketplace, Workstream Upload Context & Hardening Tests Passed Successfully!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
