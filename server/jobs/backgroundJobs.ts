import { financialTransactionService } from '../services/financialService.js';
import { processCancellationTimeouts, processAutoAcceptOrders } from '../services/orderService.js';

export async function runBackgroundJobs() {
  console.log('[BackgroundJobs] Starting financial and marketplace background jobs...');

  // 1. Earnings Clearing Job (Every 5 minutes)
  setInterval(async () => {
    try {
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
    } catch (err) {
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
