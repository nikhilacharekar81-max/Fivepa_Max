import { financialTransactionService } from '../services/financialService.js';
import { processCancellationTimeouts, processAutoAcceptOrders } from '../services/orderService.js';
import { postgresStore, isPostgresEnabled } from '../db/postgresStore.js';

export async function runBackgroundJobs() {
  console.log('[BackgroundJobs] Starting financial and marketplace background jobs...');

  // 1. Earnings Clearing Job (Every 5 minutes with advisory locking)
  setInterval(async () => {
    let client: any = null;
    try {
      if (isPostgresEnabled()) {
        client = await postgresStore.getPool().connect();
        const lockRes = await client.query('SELECT pg_try_advisory_xact_lock(74218932) AS locked');
        if (!lockRes.rows[0]?.locked) {
          client.release();
          return; // Another worker holds the advisory lock
        }
      }

      const clearableIds = await financialTransactionService.getClearableEarnings();
      if (clearableIds.length > 0) {
        console.log(`[BackgroundJobs] Found ${clearableIds.length} earnings to clear.`);
        for (const id of clearableIds) {
          try {
            await financialTransactionService.processEarningsClearing({ clearingId: id, actor: 'system:background_job' });
          } catch (itemErr) {
            console.error(`[BackgroundJobs] Failed to clear earning ${id}:`, itemErr);
          }
        }
      }

      if (client) {
        client.release();
      }
    } catch (err) {
      if (client) {
        try { client.release(); } catch {}
      }
      console.error('[BackgroundJobs] Error in earnings clearing job:', err);
    }
  }, 5 * 60 * 1000);

  // 2. Cancellation Timeouts Job (Every 60 seconds)
  setInterval(async () => {
    try {
      await processCancellationTimeouts();
    } catch (err) {
      console.error('[BackgroundJobs] Error in cancellation timeouts job:', err);
    }
  }, 60 * 1000);

  // 3. Buyer Review Window & Auto-Accept Job (Every 60 seconds)
  setInterval(async () => {
    try {
      await processAutoAcceptOrders();
    } catch (err) {
      console.error('[BackgroundJobs] Error in auto-accept job:', err);
    }
  }, 60 * 1000);
}
