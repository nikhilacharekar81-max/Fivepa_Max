import { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { store, mapPayoutRow, type Payout } from '../../store.js';
import { postgresStore } from '../../db/postgresStore.js';
import { DEFAULT_SITE_SETTINGS, siteSettings } from '../../domains/admin/siteSettings.js';
import { financialTransactionService, financialRepository } from './financial.service.js';
import { EMAIL_DELIVERY_ENABLED } from '../../services/notificationService.js';
import {
  resolveAuthenticatedUserId,
  adminActor,
  IS_PRODUCTION
} from '../../middleware/auth.js';
import { verifyAndConsumeWithdrawalCode } from '../../services/authService.js';
import { syncUserBalances, registerAuditLog } from '../../services/orderService.js';

export const ALLOWED_METHODS: Record<string, keyof typeof DEFAULT_SITE_SETTINGS.wallets.allowedPayoutMethods> = {
  'UPI': 'upi',
  'Bank Transfer': 'bankTransfer',
  'Stripe': 'stripeConnect',
  'Razorpay': 'razorpayX',
  'PayPal': 'paypal'
};

export function resolvePayoutUserId(req: Request): string | null {
  return resolveAuthenticatedUserId(req);
}

export function formatPayoutRow(r: any): Payout {
  return mapPayoutRow(r);
}

export function payoutAudit(req: Request, action: string, p: Payout, details: string) {
  registerAuditLog({
    id: 'FAUD-' + randomUUID().slice(0, 12),
    actor: adminActor(req),
    role: 'super_admin',
    action,
    target: `Payout #${p.id}`,
    details,
    timestamp: new Date().toLocaleString()
  });
}

export async function handlePayoutRequest(req: Request, res: Response) {
  try {
    const freelancerId = resolvePayoutUserId(req);
    if (!freelancerId) {
      return res.status(401).json({ error: 'Authentication required to request a payout.' });
    }
    const user = await store.getUser(freelancerId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    await financialTransactionService.ensureWallet(freelancerId);

    const verification = await verifyAndConsumeWithdrawalCode(freelancerId, req.body?.code);
    if (!verification.ok) {
      return res.status(verification.status).json({ error: verification.error });
    }

    const rawMethod = String(req.body?.method || 'Bank Transfer');
    const settingKey = ALLOWED_METHODS[rawMethod];
    const liveSettings = siteSettings.getSettings();
    const allowedMethods = liveSettings?.wallets?.allowedPayoutMethods || DEFAULT_SITE_SETTINGS.wallets.allowedPayoutMethods;
    if (!settingKey || !allowedMethods[settingKey]) {
      return res.status(400).json({ error: `Unsupported payout method "${rawMethod}".` });
    }

    const numAmount = Number(req.body?.amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid withdrawal amount greater than $0.00' });
    }

    const idempotencyKey = String(req.body?.idempotencyKey || req.headers['x-idempotency-key'] || '').trim();
    // Deterministic payoutId if idempotencyKey provided, else random
    const id = idempotencyKey
      ? ('pay_' + createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 12))
      : ('pay_' + randomUUID().slice(0, 8));

    const accountDetails = String(req.body?.accountDetails || 'Primary Bank Account').slice(0, 500);

    const payoutResult = await financialTransactionService.requestPayout({
      payoutId: id,
      freelancerId,
      amount: numAmount,
      method: rawMethod,
      accountDetails,
      actor: `user:${freelancerId}`,
      idempotencyKey: idempotencyKey || undefined
    });

    const activePayoutId = payoutResult.payoutId || id;
    let record = await store.getPayoutById(activePayoutId);
    if (!record) {
      record = {
        id: activePayoutId,
        freelancerId,
        amount: payoutResult.amount ?? numAmount,
        method: rawMethod as Payout['method'],
        status: 'pending',
        createdAt: new Date().toISOString().substring(0, 10),
        accountDetails: payoutResult.accountDetails || accountDetails
      };
      await store.savePayout(record);
    }

    await syncUserBalances();

    registerAuditLog({
      id: 'log_' + Date.now(),
      actor: user.name,
      role: user.role,
      action: 'PAYOUT_REQUESTED',
      target: `Payout #${record.id}`,
      details: `User requested withdrawal of $${numAmount.toFixed(2)} via ${record.method}`,
      timestamp: new Date().toLocaleString()
    });

    const newBalance = (await financialRepository.getWalletBalance(freelancerId)) ?? Number(user.walletBalance || 0);
    const txs = await financialRepository.getTransactions(freelancerId);
    const transaction = txs.find(t => (t as any).relatedPayoutId === activePayoutId);

    res.status(201).json({
      success: true,
      newBalance,
      payout: record,
      transaction,
      ...record
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export const approvePayout = async (req: Request, res: Response) => {
  try {
    const p = await store.getPayoutById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    if (p.status !== 'pending') return res.status(400).json({ error: `Cannot approve payout in status "${p.status}"` });

    p.status = 'approved';
    await store.savePayout(p);
    payoutAudit(req, 'PAYOUT_APPROVED', p, `Approved payout of $${p.amount} via ${p.method} for freelancer ${p.freelancerId}`);
    res.json(p);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const processPayout = async (req: Request, res: Response) => {
  try {
    const p = await store.getPayoutById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    if (p.status !== 'pending' && p.status !== 'approved') {
      return res.status(400).json({ error: `Cannot process payout in status "${p.status}"` });
    }
    if (p.amount >= 500 && p.status !== 'approved') {
      return res.status(400).json({ error: 'Payouts of $500.00 or more require explicit administrative approval before processing.' });
    }
    const providerReference = req.body?.providerReference ? String(req.body.providerReference).trim() : '';
    if (IS_PRODUCTION && !providerReference) {
      return res.status(400).json({ error: 'Explicit providerReference is required in production to process a payout.' });
    }
    const { journal } = await financialTransactionService.settlePayout({
      payoutId: p.id,
      actor: adminActor(req),
      providerReference: providerReference || `GW-SETTLE-${Date.now()}`
    });
    p.status = 'processed';
    p.processedAt = new Date().toISOString();
    payoutAudit(req, 'PAYOUT_PROCESSED', p, `Processed payout of $${p.amount} via ${p.method}`);
    await syncUserBalances();
    res.json({ success: true, payout: p, journal, ...p });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const rejectPayout = async (req: Request, res: Response) => {
  try {
    const p = await store.getPayoutById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    if (p.status !== 'pending' && p.status !== 'approved') {
      return res.status(400).json({ error: `Cannot reject payout in status "${p.status}"` });
    }
    await financialTransactionService.cancelPayout({
      payoutId: p.id,
      reason: String(req.body?.reason || 'Administrative rejection'),
      actor: adminActor(req)
    });
    p.status = 'cancelled';
    await store.savePayout(p);
    payoutAudit(req, 'PAYOUT_REJECTED', p, `Rejected payout of $${p.amount}; funds returned to wallet`);
    await syncUserBalances();
    res.json({ success: true, payout: p, ...p });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const failPayout = async (req: Request, res: Response) => {
  try {
    const p = await store.getPayoutById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    if (p.status !== 'pending' && p.status !== 'approved') {
      return res.status(400).json({ error: `Cannot fail payout in status "${p.status}"` });
    }
    await financialTransactionService.failPayout({
      payoutId: p.id,
      reason: String(req.body?.reason || 'Gateway reported a transfer failure'),
      actor: adminActor(req)
    });
    p.status = 'failed';
    await store.savePayout(p);
    payoutAudit(req, 'PAYOUT_FAILED', p, `Payout of $${p.amount} failed; funds returned to wallet`);
    await syncUserBalances();
    res.json(p);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const retryPayout = async (req: Request, res: Response) => {
  try {
    const p = await store.getPayoutById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    if (p.status !== 'failed') return res.status(400).json({ error: 'Only failed payouts can be retried.' });
    await financialTransactionService.retryPayout({ payoutId: p.id, actor: adminActor(req) });
    p.status = 'pending';
    await store.savePayout(p);
    payoutAudit(req, 'PAYOUT_RETRIED', p, `Re-queued failed payout of $${p.amount}`);
    await syncUserBalances();
    res.json(p);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};
