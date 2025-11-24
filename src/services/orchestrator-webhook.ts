import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';

export interface WebhookUpdatePayload {
  transactionHash: string;
  requestHash?: string;  // V2 approval system request hash
  blockNumber?: number;
  jobId: string;
  status: 'SUCCESS' | 'FAILED';
  approvalStatus?: string;  // PENDING_APPROVALS, EXECUTED
}

class OrchestratorWebhook {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.ORCHESTRATOR_URL || 'http://core-orchestrator-app:8080';
    this.apiKey = process.env.WEBHOOK_API_KEY || 'development-webhook-key-12345';
  }

  /**
   * Notify orchestrator about property blockchain update
   */
  async updatePropertyBlockchainTx(
    propertyId: number,
    payload: WebhookUpdatePayload
  ): Promise<void> {
    const url = `${this.baseUrl}/api/webhooks/blockchain/properties/${propertyId}`;

    logger.info(`📤 Sending webhook to orchestrator:`, {
      url,
      propertyId,
      txHash: payload.transactionHash,
      jobId: payload.jobId,
    });

    try {
      await axios.patch(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        timeout: 10000, // 10 seconds
      });

      logger.info(`✅ Webhook sent successfully: propertyId=${propertyId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error(`❌ Webhook failed:`, {
          propertyId,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          message: axiosError.message,
        });
      } else {
        logger.error(`❌ Webhook failed:`, {
          propertyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      // Don't throw - webhook failure shouldn't fail the job
      // The orchestrator can query the blockchain directly if needed
    }
  }

  /**
   * Notify orchestrator about transfer blockchain update
   */
  async updateTransferBlockchainTx(
    transferId: number,
    payload: WebhookUpdatePayload
  ): Promise<void> {
    const url = `${this.baseUrl}/api/webhooks/blockchain/transfers/${transferId}`;

    logger.info(`📤 Sending transfer webhook to orchestrator:`, {
      url,
      transferId,
      txHash: payload.transactionHash,
      jobId: payload.jobId,
    });

    try {
      await axios.patch(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        timeout: 10000,
      });

      logger.info(`✅ Transfer webhook sent successfully: transferId=${transferId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error(`❌ Transfer webhook failed:`, {
          transferId,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          message: axiosError.message,
        });
      } else {
        logger.error(`❌ Transfer webhook failed:`, {
          transferId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export const orchestratorWebhook = new OrchestratorWebhook();

