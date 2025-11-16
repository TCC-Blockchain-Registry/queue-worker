import { queueConsumer } from './queue/consumer';
import { jobProcessor } from './workers/job-processor';
import { logger } from './utils/logger';
import { config } from './config';

/**
 * Queue Worker Service
 *
 * Consumes blockchain jobs from RabbitMQ and processes them asynchronously
 */
async function main() {
  logger.info('='.repeat(60));
  logger.info('🚀 Queue Worker Service Starting...');
  logger.info('='.repeat(60));
  logger.info('Configuration:', {
    rabbitmq: config.rabbitmq.url,
    queue: config.rabbitmq.queueName,
    offchainApi: config.offchainApi.url,
    maxRetries: config.worker.maxRetryAttempts,
  });
  logger.info('='.repeat(60));

  try {
    // Connect to RabbitMQ
    await queueConsumer.connect();

    // Wait for connection to be ready
    let retries = 0;
    while (!queueConsumer.isReady() && retries < 30) {
      logger.info('Waiting for RabbitMQ connection...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }

    if (!queueConsumer.isReady()) {
      throw new Error('Failed to establish RabbitMQ connection after 30 seconds');
    }

    // Start consuming messages
    await queueConsumer.startConsuming();

    logger.info('='.repeat(60));
    logger.info('✅ Queue Worker is ready to process jobs');
    logger.info('='.repeat(60));

    // Log statistics every 60 seconds
    setInterval(() => {
      const stats = jobProcessor.getStats();
      logger.info('Worker Statistics:', stats);
    }, 60000);
  } catch (error: any) {
    logger.error('Failed to start queue worker:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing queue worker...');
  await queueConsumer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing queue worker...');
  await queueConsumer.close();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the worker
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
