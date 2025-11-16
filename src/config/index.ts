import dotenv from 'dotenv';

dotenv.config();

export const config = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672',
    queueName: process.env.QUEUE_NAME || 'blockchain-jobs',
    deadLetterQueue: process.env.DEAD_LETTER_QUEUE || 'blockchain-jobs-dlq',
    prefetchCount: parseInt(process.env.PREFETCH_COUNT || '1', 10),
  },

  offchainApi: {
    url: process.env.OFFCHAIN_API_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.OFFCHAIN_API_TIMEOUT || '120000', 10),
  },

  worker: {
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
