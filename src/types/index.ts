/**
 * Job types that can be sent to the queue
 */
export enum JobType {
  REGISTER_PROPERTY = 'REGISTER_PROPERTY',
  CONFIGURE_TRANSFER = 'CONFIGURE_TRANSFER',
  APPROVE_TRANSFER = 'APPROVE_TRANSFER',
  ACCEPT_TRANSFER = 'ACCEPT_TRANSFER',
  EXECUTE_TRANSFER = 'EXECUTE_TRANSFER',
  REGISTER_APPROVER = 'REGISTER_APPROVER',
  FREEZE_PROPERTY = 'FREEZE_PROPERTY',
  UNFREEZE_PROPERTY = 'UNFREEZE_PROPERTY',
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
  approvers: string[];
}

/**
 * Approve Transfer Job Payload
 */
export interface ApproveTransferPayload {
  transferId: string;
  matriculaId: string;
  approverAddress: string;
}

/**
 * Accept Transfer Job Payload
 */
export interface AcceptTransferPayload {
  transferId: string;
  matriculaId: string;
  buyerAddress: string;
}

/**
 * Execute Transfer Job Payload
 */
export interface ExecuteTransferPayload {
  transferId: string;
  matriculaId: string;
  seller: string;
  buyer: string;
}

/**
 * Register Approver Job Payload
 */
export interface RegisterApproverPayload {
  name: string;
  walletAddress: string;
  entityType: string;
}

/**
 * Job processing result
 */
export interface JobResult {
  success: boolean;
  txHash?: string;
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
