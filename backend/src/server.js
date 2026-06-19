import dotenv from 'dotenv';
dotenv.config();

import { provider } from '../config/blockchain.js';

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import farmerRoutes from './routes/farmerRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cooperativeRoutes from './routes/cooperativeRoutes.js';
import processorRoutes from './routes/processorRoutes.js';
import exporterRoutes from './routes/exporterRoutes.js';
import receiverRoutes from './routes/receiverRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

import { prisma } from './utils/prisma.js';
// import { startContractIndexer } from './indexer/worker.js';

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://coffee-trace-frontend-ashen.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true
}));

app.use((req, res, next) => {
  console.log('[REQUEST]', req.method, req.originalUrl, '- content-type:', req.headers['content-type']);
  next();
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cooperative', cooperativeRoutes);
app.use('/api/processor', processorRoutes);
app.use('/api/exporter', exporterRoutes);
app.use('/api/receiver', receiverRoutes);
app.use('/api/public', publicRoutes);

app.get('/health', async (req, res) => {
  const healthStatus = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: new Date(),
    infrastructure: {
      expressServer: 'UP',
      postgresql: 'DOWN'
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.infrastructure.postgresql = 'UP';
  } catch (error) {
    healthStatus.status = 'ERROR';
    healthStatus.errorDetails = error.message;
  }

  try {
    if (provider) {
      const blockNumber = await provider.getBlockNumber();
      const network = await provider.getNetwork();
      
      healthStatus.infrastructure.blockchainNode = 'UP';
      healthStatus.blockchainDetails = {
        currentBlock: blockNumber,
        chainId: network.chainId.toString(),
        networkName: network.name
      };
    }
  } catch (error) {
    healthStatus.status = 'ERROR';
    healthStatus.blockchainError = error.message;
  }

  const statusCode = healthStatus.status === 'OK' ? 200 : 503;
  return res.status(statusCode).json(healthStatus);
});

app.listen(PORT, () => {
  console.log(`Server is running at: http://localhost:${PORT}`);
  console.log(`Health Check at: http://localhost:${PORT}/health`);

  // startContractIndexer();
});

export default app;