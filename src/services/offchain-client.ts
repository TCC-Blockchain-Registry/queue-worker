import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import {
  ConfigureTransferPayload,
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
      const response = await this.client.post('/api/transfers/request', {
        from: payload.seller,
        to: payload.buyer,
        matriculaId: payload.matriculaId,
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
}

export const offchainClient = new OffchainClient();
