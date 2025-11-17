#!/usr/bin/env node

/**
 * Test Producer - Sends test jobs to RabbitMQ queue
 * 
 * Usage:
 *   node test-producer.js                     # Send test property registration
 *   node test-producer.js register 555666     # Register specific property
 *   node test-producer.js configure           # Configure transfer
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';
const QUEUE_NAME = process.env.QUEUE_NAME || 'blockchain-jobs';

// Test data
const TEST_ADMIN_WALLET = '0x565524f400856766f11562832eB809d889491a01';

// Job templates
const JOB_TEMPLATES = {
  REGISTER_PROPERTY: (matriculaId = '555666') => ({
    id: uuidv4(),
    type: 'REGISTER_PROPERTY',
    payload: {
      matriculaId: matriculaId,
      folha: '300',
      comarca: 'São Paulo - SP',
      endereco: `Av. Teste Queue, ${matriculaId}`,
      metragem: '180',
      proprietario: TEST_ADMIN_WALLET,
      matriculaOrigem: '0',
      tipo: 0,
      isRegular: true
    },
    createdAt: new Date().toISOString(),
    maxAttempts: 3
  }),

  CONFIGURE_TRANSFER: (matriculaId = '555666') => ({
    id: uuidv4(),
    type: 'CONFIGURE_TRANSFER',
    payload: {
      from: TEST_ADMIN_WALLET,
      to: '0x1234567890123456789012345678901234567890',
      matriculaId: matriculaId,
      approvers: [
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      ]
    },
    createdAt: new Date().toISOString(),
    maxAttempts: 3
  }),

  REGISTER_APPROVER: () => ({
    id: uuidv4(),
    type: 'REGISTER_APPROVER',
    payload: {
      wallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      approverType: 0, // Cartório
      name: 'Cartório Teste',
      document: '12345678000100'
    },
    createdAt: new Date().toISOString(),
    maxAttempts: 3
  })
};

async function sendJob(job) {
  let connection;
  let channel;
  
  try {
    console.log('\n📡 Conectando ao RabbitMQ...');
    console.log(`   URL: ${RABBITMQ_URL}`);
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true
    });

    console.log(`✅ Conectado à fila: ${QUEUE_NAME}`);
    console.log('\n📦 Enviando job:', {
      id: job.id,
      type: job.type,
      payload: JSON.stringify(job.payload, null, 2)
    });

    // Send message
    channel.sendToQueue(
      QUEUE_NAME,
      Buffer.from(JSON.stringify(job)),
      {
        persistent: true,
        contentType: 'application/json'
      }
    );

    console.log('\n✅ Job enviado com sucesso!');
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Job Type: ${job.type}`);
    console.log('\n💡 O queue-worker deve processar este job em breve.');
    console.log('   Para ver o progresso, execute: npm run dev (no queue-worker)');

  } catch (error) {
    console.error('\n❌ Erro ao enviar job:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Dica: Certifique-se de que o RabbitMQ está rodando:');
      console.error('   cd message-queue && docker compose up -d');
    }
    
    process.exit(1);
  } finally {
    try {
      if (channel) await channel.close();
      if (connection) await connection.close();
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

// Parse command line arguments
const command = process.argv[2] || 'register';
const arg1 = process.argv[3];

console.log('='.repeat(60));
console.log('🧪 Test Producer - RabbitMQ Job Publisher');
console.log('='.repeat(60));

let job;

switch (command.toLowerCase()) {
  case 'register':
    job = JOB_TEMPLATES.REGISTER_PROPERTY(arg1);
    console.log(`\n📝 Criando job: Registrar Propriedade ${job.payload.matriculaId}`);
    break;

  case 'configure':
    job = JOB_TEMPLATES.CONFIGURE_TRANSFER(arg1);
    console.log(`\n⚙️  Criando job: Configurar Transferência ${job.payload.matriculaId}`);
    break;

  case 'approver':
    job = JOB_TEMPLATES.REGISTER_APPROVER();
    console.log('\n👤 Criando job: Registrar Aprovador');
    break;

  default:
    console.log(`\n❌ Comando desconhecido: ${command}`);
    console.log('\nComandos disponíveis:');
    console.log('  register [matricula]  - Registrar propriedade');
    console.log('  configure [matricula] - Configurar transferência');
    console.log('  approver              - Registrar aprovador');
    console.log('\nExemplos:');
    console.log('  node test-producer.js register 999888');
    console.log('  node test-producer.js configure 555666');
    console.log('  node test-producer.js approver');
    process.exit(1);
}

sendJob(job);

