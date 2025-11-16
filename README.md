# Queue Worker - Blockchain Job Processor

Asynchronous worker service that consumes blockchain jobs from RabbitMQ and executes them via the Offchain API.

## Purpose

The Queue Worker:
- **Consumes** blockchain jobs from RabbitMQ
- **Processes** jobs asynchronously by calling Offchain API
- **Retries** failed jobs with exponential backoff
- **Sends** failed jobs to dead letter queue after max retries
- **Monitors** job statistics and health

## Architecture

```
Orchestrator (Spring Boot)
    ↓ Publishes job to queue
RabbitMQ Queue (blockchain-jobs)
    ↓ Worker consumes
Queue Worker (THIS SERVICE)
    ↓ HTTP call
Offchain API
    ↓ JSON-RPC
Blockchain (Besu)
```

## Job Types

The worker processes these job types:

1. **REGISTER_PROPERTY** - Register new property on blockchain
2. **CONFIGURE_TRANSFER** - Configure property transfer with approvers
3. **APPROVE_TRANSFER** - Approver approves transfer
4. **ACCEPT_TRANSFER** - Buyer accepts transfer
5. **EXECUTE_TRANSFER** - Execute final transfer
6. **REGISTER_APPROVER** - Register new approver entity
7. **FREEZE_PROPERTY** - Freeze property (emergency)
8. **UNFREEZE_PROPERTY** - Unfreeze property

## Setup

### Prerequisites
- Node.js 18+
- RabbitMQ running on port 5672
- Offchain API running on port 3000

### Installation

```bash
npm install
```

### Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
QUEUE_NAME=blockchain-jobs
OFFCHAIN_API_URL=http://localhost:3000
MAX_RETRY_ATTEMPTS=3
```

## Development

```bash
# Development mode (auto-reload)
npm run dev

# Build TypeScript
npm run build

# Production mode
npm start
```

## How It Works

### Job Processing Flow

1. **Consumer** receives message from RabbitMQ
2. **Parser** deserializes job from JSON
3. **Processor** routes job to appropriate worker based on type
4. **Worker** calls Offchain API endpoint
5. **Offchain API** submits transaction to blockchain
6. **Result** is evaluated:
   - **Success**: Message acknowledged (removed from queue)
   - **Failure**: Retry with exponential backoff
   - **Max retries exceeded**: Send to dead letter queue

### Retry Logic

```typescript
Attempt 1: Immediate
Attempt 2: Wait 5 seconds
Attempt 3: Wait 10 seconds
Attempt 4+: Exponential backoff (max 30s)

After max attempts (default 3): → Dead Letter Queue
```

### Error Handling

- **Temporary errors** (network, timeout): Retry
- **Permanent errors** (validation, bad data): Dead letter queue immediately
- **Unknown errors**: Retry with caution

## Job Structure

```json
{
  "id": "unique-job-id",
  "type": "REGISTER_PROPERTY",
  "payload": {
    "matriculaId": "12345",
    "ownerWallet": "0x...",
    "metadata": {
      "address": "Rua ABC, 123",
      "area": 100,
      "propertyType": "residential"
    }
  },
  "createdAt": "2025-01-15T10:00:00Z",
  "attempts": 0,
  "maxAttempts": 3
}
```

## Monitoring

### Statistics

The worker logs statistics every 60 seconds:

```json
{
  "totalProcessed": 150,
  "successful": 145,
  "failed": 5,
  "retried": 12,
  "uptime": 3600000,
  "startedAt": "2025-01-15T10:00:00Z"
}
```

### Logs

Logs are written to stdout in JSON format:

```
[2025-01-15T10:00:00.000Z] [INFO] Job abc123 [REGISTER_PROPERTY] STARTED - Attempt 1
[2025-01-15T10:00:02.000Z] [INFO] Job abc123 [REGISTER_PROPERTY] COMPLETED - TX: 0x...
```

## Dead Letter Queue

Failed jobs are sent to `blockchain-jobs-dlq` with additional metadata:

```json
{
  "id": "failed-job-id",
  "type": "REGISTER_PROPERTY",
  "payload": { ... },
  "failedAt": "2025-01-15T10:05:00Z",
  "error": "Transaction reverted: insufficient gas"
}
```

### Processing Dead Letter Queue

To manually reprocess failed jobs:

1. Inspect dead letter queue: `http://localhost:15672` (RabbitMQ Management UI)
2. Identify fixable issues
3. Republish to main queue after fixing

## Docker

```bash
# Build image
docker build -t queue-worker .

# Run container
docker run \
  -e RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672 \
  -e OFFCHAIN_API_URL=http://offchain:3000 \
  queue-worker
```

## Scaling

The worker is **stateless** and can be horizontally scaled:

```bash
# Run multiple workers
docker-compose up --scale queue-worker=3
```

RabbitMQ will distribute jobs across all workers using round-robin.

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| RABBITMQ_URL | amqp://localhost:5672 | RabbitMQ connection URL |
| QUEUE_NAME | blockchain-jobs | Main queue name |
| DEAD_LETTER_QUEUE | blockchain-jobs-dlq | Failed jobs queue |
| PREFETCH_COUNT | 1 | Max unacknowledged messages |
| OFFCHAIN_API_URL | http://localhost:3000 | Offchain API URL |
| OFFCHAIN_API_TIMEOUT | 120000 | API timeout (ms) |
| MAX_RETRY_ATTEMPTS | 3 | Max retry attempts |
| RETRY_DELAY_MS | 5000 | Base retry delay |
| LOG_LEVEL | info | Logging level |

## Troubleshooting

**"Failed to connect to RabbitMQ"**
- Ensure RabbitMQ is running: `docker ps`
- Check connection URL in `.env`
- Verify credentials (admin/admin123)

**"Offchain service is unavailable"**
- Ensure Offchain API is running on port 3000
- Check `OFFCHAIN_API_URL` in `.env`

**Jobs stuck in queue**
- Check worker logs for errors
- Verify Offchain API is responding
- Check RabbitMQ Management UI: http://localhost:15672

**High retry rate**
- Check blockchain node is running (Besu)
- Verify contract addresses in Offchain API
- Check gas settings

## Architecture Notes

This worker follows the **Competing Consumers** pattern:
- Multiple workers can run in parallel
- Each worker processes one job at a time (`prefetchCount: 1`)
- Jobs are distributed evenly across workers
- Failed jobs are retried automatically
- Poison messages go to dead letter queue

For production:
- Run at least 2 workers for redundancy
- Monitor dead letter queue regularly
- Set up alerts for high failure rates
- Use persistent queues (already configured)
