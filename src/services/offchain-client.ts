import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import {
  ConfigureTransferPayload,
  ApproveTransferPayload,
  AcceptTransferPayload,
  ExecuteTransferPayload,
  RegisterApproverPayload,
  JobResult,
} from '../types';

class OffchainClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.offchainApi.url,
      timeout: config.offchainApi.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Offchain API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Offchain API] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Offchain API] Response: ${response.status}`);
        return response;
      },
      (error) => {
        if (error.response) {
          console.error(
            `[Offchain API] Error ${error.response.status}:`,
            error.response.data
          );
        } else if (error.request) {
          console.error('[Offchain API] No response received:', error.message);
        } else {
          console.error('[Offchain API] Request setup error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async registerProperty(payload: any): Promise<JobResult> {
    try {
      // Enviar payload diretamente para a API
      const response = await this.client.post('/api/properties/register', payload);

      // V2: Sistema de aprovações manuais retorna requestHash, txHash, status, etc
      const responseData = response.data.data || response.data;
      
      return {
        success: true,
        txHash: responseData.txHash || responseData.issueTxHash || response.data.txHash,
        requestHash: responseData.requestHash,
        blockNumber: responseData.blockNumber,
        status: responseData.status,
        message: 'Property registration request created successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
      };
    }
  }

  async configureTransfer(payload: ConfigureTransferPayload): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/transfers/configure', {
        // ✅ CORREÇÃO: Usar 'from' e 'to' ao invés de 'seller' e 'buyer'
        from: payload.seller,  // Vendedor = from
        to: payload.buyer,      // Comprador = to
        matriculaId: payload.matriculaId,
        approvers: payload.approvers,
      });

      return {
        success: true,
        txHash: response.data.data?.txHash || response.data.txHash,
        transferId: payload.transferId, // Preservar transferId para webhook
        message: 'Transfer configured successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
      };
    }
  }

  async approveTransfer(payload: ApproveTransferPayload): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/transfers/approve', {
        // ✅ CORREÇÃO: Adicionar from/to necessários para Offchain API
        from: payload.from,
        to: payload.to,
        matriculaId: payload.matriculaId,
        approverAddress: payload.approverAddress,
        // ⚠️  NOTA: approverPrivateKey deve ser obtido localmente pelo Offchain API,
        // não deve ser transmitido via HTTP por segurança
      });

      return {
        success: true,
        txHash: response.data.txHash,
        message: 'Transfer approved successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async acceptTransfer(payload: AcceptTransferPayload): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/transfers/accept', {
        transferId: payload.transferId,
        matriculaId: payload.matriculaId,
        buyerAddress: payload.buyerAddress,
      });

      return {
        success: true,
        txHash: response.data.txHash,
        message: 'Transfer accepted successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async executeTransfer(payload: ExecuteTransferPayload): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/transfers/execute', {
        transferId: payload.transferId,
        matriculaId: payload.matriculaId,
        seller: payload.seller,
        buyer: payload.buyer,
      });

      return {
        success: true,
        txHash: response.data.txHash,
        message: 'Transfer executed successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async registerApprover(payload: RegisterApproverPayload): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/approvers/register', {
        name: payload.name,
        walletAddress: payload.walletAddress,
        entityType: payload.entityType,
      });

      return {
        success: true,
        txHash: response.data.txHash,
        message: 'Approver registered successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async freezeProperty(matriculaId: string, wallet: string): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/admin/freeze-property', {
        matriculaId,
        wallet,
      });

      return {
        success: true,
        txHash: response.data.txHash,
        message: 'Property frozen successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async unfreezeProperty(matriculaId: string, wallet: string): Promise<JobResult> {
    try {
      const response = await this.client.post('/api/admin/unfreeze-property', {
        matriculaId,
        wallet,
      });

      return {
        success: true,
        txHash: response.data.txHash,
        message: 'Property unfrozen successfully',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
}

export const offchainClient = new OffchainClient();
