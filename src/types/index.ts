/**
 * Job types that can be sent to the queue
 */
export enum JobType {
  REGISTER_PROPERTY = 'REGISTER_PROPERTY',
  CONFIGURE_TRANSFER = 'CONFIGURE_TRANSFER',
}

/**
 * Base job structure
 */
export interface BlockchainJob {
  id: string;
  type: JobType;
  payload: any;
  createdAt: string;
  attempts?: number;
  maxAttempts?: number;
}

/**
 * Register Property Job Payload
 */
export interface RegisterPropertyPayload {
  matriculaId: string;
  ownerWallet: string;
  metadata: {
    address: string;
    area: number;
    propertyType: string;
    [key: string]: any;
  };
}

/**
 * Configure Transfer Job Payload
 */
export interface ConfigureTransferPayload {
  transferId: string;
  matriculaId: string;
  seller: string;
  buyer: string;
}

/**
 * Job processing result
 */
export interface JobResult {
  success: boolean;
  txHash?: string;
  requestHash?: string;  // V2 approval system request hash
  transferId?: string;   // Transfer ID for transfer operations
  blockNumber?: number;
  status?: string;  // PENDING_APPROVALS, EXECUTED, etc
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  retried: number;
  uptime: number;
  startedAt: string;
}
