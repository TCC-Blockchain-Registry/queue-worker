import { offchainClient } from '../services/offchain-client';
import { orchestratorWebhook } from '../services/orchestrator-webhook';
import { config } from '../config';
import { logger } from '../utils/logger';
import { delay, exponentialBackoff } from '../utils/delay';
import { BlockchainJob, JobType, JobResult } from '../types';

export class JobProcessor {
  private stats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    retried: 0,
    startedAt: new Date().toISOString(),
  };

  async processJob(job: BlockchainJob): Promise<JobResult> {
    const { id, type, payload, attempts = 0 } = job;

    logger.job(id, type, 'STARTED', `Attempt ${attempts + 1}`);

    try {
      let result: JobResult;

      switch (type) {
        case JobType.REGISTER_PROPERTY:
          result = await offchainClient.registerProperty(payload);
          break;

        case JobType.CONFIGURE_TRANSFER:
          result = await offchainClient.configureTransfer(payload);
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      if (result.success) {
        this.stats.successful++;
        this.stats.totalProcessed++;
        logger.job(id, type, 'COMPLETED', `TX: ${result.txHash}`);
        
        // Send webhook callback to orchestrator
        if (result.txHash) {
          await this.sendWebhookCallback(type, payload, result, id);
        }
        
        return result;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      logger.error(`Job ${id} failed:`, error.message);

      const maxAttempts = job.maxAttempts || config.worker.maxRetryAttempts;
      const currentAttempt = attempts + 1;

      if (currentAttempt < maxAttempts) {
        this.stats.retried++;
        const delayMs = exponentialBackoff(currentAttempt, config.worker.retryDelayMs);
        logger.job(id, type, 'RETRY', `Will retry in ${delayMs}ms`);

        await delay(delayMs);

        return this.processJob({
          ...job,
          attempts: currentAttempt,
        });
      } else {
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

  private async sendWebhookCallback(
    jobType: JobType,
    payload: any,
    result: any,
    jobId: string
  ): Promise<void> {
    try {
      // Only send webhook for property registration for now
      // Can be extended for transfers and other operations
      if (jobType === JobType.REGISTER_PROPERTY && payload.propertyId) {
        await orchestratorWebhook.updatePropertyBlockchainTx(
          payload.propertyId,
          {
            transactionHash: result.txHash,
            requestHash: result.requestHash,  // V2 approval system
            blockNumber: result.blockNumber,
            approvalStatus: result.status || 'PENDING_APPROVALS',
            jobId: jobId,
            status: 'SUCCESS',
          }
        );
      }
      // TODO: Add webhook support for transfers
      // if (jobType === JobType.CONFIGURE_TRANSFER && payload.transferId) { ... }
    } catch (error: any) {
      // Log but don't fail the job if webhook fails
      logger.error(`Webhook callback failed:`, {
        jobType,
        jobId,
        error: error.message,
      });
    }
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - new Date(this.stats.startedAt).getTime(),
    };
  }

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
