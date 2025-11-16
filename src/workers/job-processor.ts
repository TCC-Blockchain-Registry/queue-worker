import { offchainClient } from '../services/offchain-client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { delay, exponentialBackoff } from '../utils/delay';
import { BlockchainJob, JobType, JobResult } from '../types';

/**
 * Job Processor
 *
 * Processes blockchain jobs by calling the appropriate Offchain API endpoint
 * Implements retry logic with exponential backoff
 */
export class JobProcessor {
  private stats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    retried: 0,
    startedAt: new Date().toISOString(),
  };

  /**
   * Process a blockchain job
   */
  async processJob(job: BlockchainJob): Promise<JobResult> {
    const { id, type, payload, attempts = 0 } = job;

    logger.job(id, type, 'STARTED', `Attempt ${attempts + 1}`);

    try {
      // Route to appropriate worker based on job type
      let result: JobResult;

      switch (type) {
        case JobType.REGISTER_PROPERTY:
          result = await offchainClient.registerProperty(payload);
          break;

        case JobType.CONFIGURE_TRANSFER:
          result = await offchainClient.configureTransfer(payload);
          break;

        case JobType.APPROVE_TRANSFER:
          result = await offchainClient.approveTransfer(payload);
          break;

        case JobType.ACCEPT_TRANSFER:
          result = await offchainClient.acceptTransfer(payload);
          break;

        case JobType.EXECUTE_TRANSFER:
          result = await offchainClient.executeTransfer(payload);
          break;

        case JobType.REGISTER_APPROVER:
          result = await offchainClient.registerApprover(payload);
          break;

        case JobType.FREEZE_PROPERTY:
          result = await offchainClient.freezeProperty(
            payload.matriculaId,
            payload.wallet
          );
          break;

        case JobType.UNFREEZE_PROPERTY:
          result = await offchainClient.unfreezeProperty(
            payload.matriculaId,
            payload.wallet
          );
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // Handle result
      if (result.success) {
        this.stats.successful++;
        this.stats.totalProcessed++;
        logger.job(id, type, 'COMPLETED', `TX: ${result.txHash}`);
        return result;
      } else {
        // Job failed but didn't throw error
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      logger.error(`Job ${id} failed:`, error.message);

      // Check if we should retry
      const maxAttempts = job.maxAttempts || config.worker.maxRetryAttempts;
      const currentAttempt = attempts + 1;

      if (currentAttempt < maxAttempts) {
        // Retry with exponential backoff
        this.stats.retried++;
        const delayMs = exponentialBackoff(currentAttempt, config.worker.retryDelayMs);
        logger.job(id, type, 'RETRY', `Will retry in ${delayMs}ms`);

        await delay(delayMs);

        // Recursive retry
        return this.processJob({
          ...job,
          attempts: currentAttempt,
        });
      } else {
        // Max retries exceeded
        this.stats.failed++;
        this.stats.totalProcessed++;
        logger.job(id, type, 'FAILED', `Max retries (${maxAttempts}) exceeded`);

        return {
          success: false,
          error: error.message,
        };
      }
    }
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - new Date(this.stats.startedAt).getTime(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      startedAt: new Date().toISOString(),
    };
  }
}

export const jobProcessor = new JobProcessor();
