import { RepoContext } from '../types.js';
import type { PaymentMethodRecord } from '../../../src/types.js';
import {
  type Refund,
  type Payout,
  mapRefundRow,
  mapPayoutRow,
  mapPaymentMethodRow
} from '../../store.js';

export type { PaymentMethodRecord };

export class FinanceRepo {
  constructor(private ctx: RepoContext) {}

  // --- REFUNDS ---
  async saveRefunds(refunds: Refund[]): Promise<void> {
    return this.ctx.withLock('refunds', async () => {
      if (!refunds) return;
      const client = await this.ctx.getPool().connect();
      try {
        await client.query('BEGIN');
        const seen = new Set<string>();
        for (const ref of refunds) {
          if (!ref?.id || seen.has(ref.id)) continue;
          seen.add(ref.id);
          await client.query(
            `INSERT INTO refunds (id, order_id, buyer_id, amount, reason, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               reason = COALESCE(EXCLUDED.reason, refunds.reason)`,
            [ref.id, ref.orderId, ref.buyerId, ref.amount, ref.reason || null, ref.status, ref.createdAt]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    });
  }

  async saveRefund(ref: Refund): Promise<void> {
    return this.saveRefunds([ref]);
  }

  async listRefunds(): Promise<Refund[]> {
    const res = await this.ctx.getPool().query('SELECT * FROM refunds');
    return res.rows.map(mapRefundRow);
  }

  async getRefundById(id: string): Promise<Refund | null> {
    const res = await this.ctx.getPool().query('SELECT * FROM refunds WHERE id = $1', [id]);
    return res.rows.length > 0 ? mapRefundRow(res.rows[0]) : null;
  }

  async listRefundsForOrder(orderId: string): Promise<Refund[]> {
    const res = await this.ctx.getPool().query('SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at DESC', [orderId]);
    return res.rows.map(mapRefundRow);
  }

  // --- PAYOUTS ---
  async savePayout(p: Payout): Promise<void> {
    if (!p?.id) return;
    return this.ctx.withLock(`payout_${p.id}`, async () => {
      await this.ctx.getPool().query(
        `INSERT INTO payouts (id, freelancer_id, amount, method, status, created_at, account_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           account_details = COALESCE(EXCLUDED.account_details, payouts.account_details)`,
        [p.id, p.freelancerId, p.amount, p.method, p.status, p.createdAt, p.accountDetails || null]
      );
    });
  }

  async savePayouts(payouts: Payout[]): Promise<void> {
    return this.ctx.withLock('payouts', async () => {
      if (!payouts) return;
      const client = await this.ctx.getPool().connect();
      try {
        await client.query('BEGIN');
        for (const p of payouts) {
          if (!p?.id) continue;
          await client.query(
            `INSERT INTO payouts (id, freelancer_id, amount, method, status, created_at, account_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               account_details = COALESCE(EXCLUDED.account_details, payouts.account_details)`,
            [p.id, p.freelancerId, p.amount, p.method, p.status, p.createdAt, p.accountDetails || null]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    });
  }

  async listPayouts(): Promise<Payout[]> {
    const res = await this.ctx.getPool().query('SELECT * FROM payouts ORDER BY created_at DESC');
    return res.rows.map(mapPayoutRow);
  }

  async getPayoutById(id: string): Promise<Payout | null> {
    const res = await this.ctx.getPool().query('SELECT * FROM payouts WHERE id = $1', [id]);
    return res.rows.length > 0 ? mapPayoutRow(res.rows[0]) : null;
  }

  async listPayoutsForUser(freelancerId: string): Promise<Payout[]> {
    const res = await this.ctx.getPool().query(
      'SELECT * FROM payouts WHERE freelancer_id = $1 ORDER BY created_at DESC',
      [freelancerId]
    );
    return res.rows.map(mapPayoutRow);
  }

  // --- PAYMENT METHODS ---
  mapPaymentMethodRow(r: any): PaymentMethodRecord {
    return mapPaymentMethodRow(r);
  }

  async getPaymentMethodById(id: string): Promise<PaymentMethodRecord | null> {
    const res = await this.ctx.getPool().query('SELECT * FROM payment_methods WHERE id = $1', [id]);
    return res.rows.length > 0 ? this.mapPaymentMethodRow(res.rows[0]) : null;
  }

  async listPaymentMethodsForUser(userId: string): Promise<PaymentMethodRecord[]> {
    const res = await this.ctx.getPool().query(
      'SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    return res.rows.map(r => this.mapPaymentMethodRow(r));
  }

  async listPaymentMethods(): Promise<PaymentMethodRecord[]> {
    const res = await this.ctx.getPool().query('SELECT * FROM payment_methods ORDER BY created_at DESC');
    return res.rows.map(r => this.mapPaymentMethodRow(r));
  }

  async savePaymentMethod(pm: PaymentMethodRecord | any): Promise<void> {
    if (!pm?.id) return;
    return this.ctx.withLock(`pm_${pm.userId}`, async () => {
      if (pm.isDefault) {
        await this.ctx.getPool().query('UPDATE payment_methods SET is_default = false WHERE user_id = $1', [pm.userId]);
      }
      await this.ctx.getPool().query(
        `INSERT INTO payment_methods (id, user_id, type, name, details, is_default, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           type = EXCLUDED.type,
           name = EXCLUDED.name,
           details = EXCLUDED.details,
           is_default = EXCLUDED.is_default`,
        [pm.id, pm.userId, pm.type, pm.name, JSON.stringify(pm.details || {}), Boolean(pm.isDefault), pm.createdAt || new Date().toISOString().substring(0, 10)]
      );
    });
  }

  async savePaymentMethods(methods: PaymentMethodRecord[]): Promise<void> {
    for (const m of methods) {
      await this.savePaymentMethod(m);
    }
  }

  async deletePaymentMethod(id: string): Promise<void> {
    await this.ctx.getPool().query('DELETE FROM payment_methods WHERE id = $1', [id]);
  }

  async setDefaultPaymentMethod(userId: string, id: string): Promise<void> {
    return this.ctx.withLock(`pm_${userId}`, async () => {
      await this.ctx.getPool().query('UPDATE payment_methods SET is_default = false WHERE user_id = $1', [userId]);
      await this.ctx.getPool().query('UPDATE payment_methods SET is_default = true WHERE id = $1 AND user_id = $2', [id, userId]);
    });
  }

  // --- PAYMENT GATEWAYS ---
  async savePaymentGateways(gateways: any): Promise<void> {
    return this.ctx.withLock('payment_gateways', async () => {
      await this.ctx.getPool().query(
        `INSERT INTO payment_gateways (key, value, updated_at)
         VALUES ('primary', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(gateways)]
      );
    });
  }

  async loadPaymentGateways(): Promise<any | null> {
    const res = await this.ctx.getPool().query("SELECT value FROM payment_gateways WHERE key = 'primary'");
    return res.rows.length > 0 ? res.rows[0].value : null;
  }

  // --- FINANCIAL LEDGER STATE ---
  async saveLedgerState(state: any): Promise<void> {
    return this.ctx.withLock('financial_ledger_state', async () => {
      const query = `INSERT INTO financial_ledger_state (key, value, updated_at)
         VALUES ('primary', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      const params = [JSON.stringify(state)];
      await this.ctx.getPool().query(query, params);
    });
  }

  async loadLedgerState(): Promise<any | null> {
    const res = await this.ctx.getPool().query("SELECT value FROM financial_ledger_state WHERE key = 'primary'");
    return res.rows.length > 0 ? res.rows[0].value : null;
  }
}
