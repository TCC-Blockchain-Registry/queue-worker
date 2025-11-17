import amqp from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { jobProcessor } from '../workers/job-processor';
import { BlockchainJob } from '../types';

export class QueueConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ...', { url: config.rabbitmq.url });

      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      await this.channel.prefetch(config.rabbitmq.prefetchCount);

      await this.channel.assertQueue(config.rabbitmq.queueName, {
        durable: true,
      });

      await this.channel.assertQueue(config.rabbitmq.deadLetterQueue, {
        durable: true,
      });

      this.isConnected = true;
      logger.info('Connected to RabbitMQ successfully');

      this.connection!.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });

      this.connection!.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000);
      });
    } catch (error: any) {
      logger.error('Failed to connect to RabbitMQ:', error.message);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    logger.info(`Starting to consume from queue: ${config.rabbitmq.queueName}`);

    await this.channel.consume(
      config.rabbitmq.queueName,
      async (msg: amqp.ConsumeMessage | null) => {
        console.log('[DEBUG] Message received from queue!', {
          hasMessage: !!msg,
          messageSize: msg?.content?.length,
        });
        
        if (!msg) {
          logger.warn('Received null message');
          return;
        }

        await this.handleMessage(msg);
      },
      {
        noAck: false,
      }
    );

    logger.info('Consumer started successfully');
  }

  private async handleMessage(msg: amqp.ConsumeMessage): Promise<void> {
    console.log('[DEBUG] handleMessage called');
    if (!this.channel) {
      console.log('[DEBUG] No channel, returning');
      return;
    }

    try {
      console.log('[DEBUG] Parsing message content...');
      const job: BlockchainJob = JSON.parse(msg.content.toString());

      console.log('[DEBUG] Message parsed successfully:', {
        id: job.id,
        type: job.type,
      });

      logger.info('📥 Received job:', {
        id: job.id,
        type: job.type,
      });

      console.log('[DEBUG] Processing job...');
      const result = await jobProcessor.processJob(job);

      console.log('[DEBUG] Job processed:', { success: result.success });

      if (result.success) {
        this.channel.ack(msg);
        logger.info(`✅ Job ${job.id} acknowledged`);
      } else {
        this.channel.nack(msg, false, false);
        logger.warn(`❌ Job ${job.id} sent to dead letter queue`);

        await this.sendToDeadLetterQueue(job, result.error);
      }
    } catch (error: any) {
      console.error('[DEBUG] Error in handleMessage:', error);
      logger.error('Error handling message:', error.message);

      this.channel.nack(msg, false, true);
    }
  }

  private async sendToDeadLetterQueue(job: BlockchainJob, error?: string): Promise<void> {
    if (!this.channel) return;

    try {
      const deadLetterJob = {
        ...job,
        failedAt: new Date().toISOString(),
        error,
      };

      await this.channel.sendToQueue(
        config.rabbitmq.deadLetterQueue,
        Buffer.from(JSON.stringify(deadLetterJob)),
        {
          persistent: true,
        }
      );

      logger.info(`Job ${job.id} sent to dead letter queue`);
    } catch (error: any) {
      logger.error('Failed to send to dead letter queue:', error.message);
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isConnected = false;
      logger.info('RabbitMQ connection closed');
    } catch (error: any) {
      logger.error('Error closing RabbitMQ connection:', error.message);
    }
  }

  isReady(): boolean {
    return this.isConnected && this.channel !== null;
  }
}

export const queueConsumer = new QueueConsumer();
